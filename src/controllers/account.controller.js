import accountModel from '../models/account.model.js';
import benificiaryModel from '../models/benificiary.model.js';
import { onAccountCreation } from './notification.controller.js';


async function createAccount(req, resp) {
    try {
        const { accountTitle, pin } = req.body;
        const user = req.user;

        const accountAlreadyExists = await accountModel.findOne({ user: user._id }).lean();
        if (accountAlreadyExists) {
            return resp.status(422).json({
                statusCode: 422,
                status: "failed",
                message: "An account with this title already exists",
            });
        }
        const account = await accountModel.create({ user: user._id, accountTitle, pin });
        /*
         onMoneySent({
                    senderUserId: req.user._id,
                    recipientUserId: toUserAccount.user,
                    senderName: req.user.name,
                    recipientName: toUser?.name ?? 'Recipient',
                    amount,
                    currency: fromUserAccount.currency,
                    transactionId: transaction._id,
                });
         */
        onAccountCreation({
            recipientUserId: user._id,
            accountNumber: account.accountNumber
        })
        return resp.status(201).json(
            {
                statusCode: 201,
                status: "success",
                message: "Account created successfully",
                account: account
            }

        );
    } catch (error) {
        console.error("[createAccount]", error);
        return resp.status(500).json({
            statusCode: 500,
            status: "failed",
            message: "Internal server error",
        });
    }
}
async function changeAccountStatus(req, resp) {
    try {
        const { status } = req.params;

        const account = await accountModel.findOne({ user: req.user._id });

        if (!account) {
            return resp.status(404).json({ message: "Account not found" });
        }

        if (account.status === status) {
            return resp.status(400).json({ message: `Account is already ${status}` });
        }
        account.status = status;
        await account.save();


        return resp.status(200).json({
            message: "Account status changed successfully",
            account
        });

    } catch (error) {
        console.error("[changeAccountStatus]", error);
        return resp.status(500).json({
            statusCode: 500,
            status: "failed",
            message: "Internal server error",
        });
    }
}

async function changePin(req, resp) {
    try {
        const { oldPin, newPin } = req.body;
        const user = req.user;

        // ✅ Fix 1: added const
        const account = await accountModel.findOne({ user: user._id }).select('+pin');

        if (!account) {
            return resp.status(404).json({ message: "Account not found" });
        }
        console.log("account", account);
        const oldPinMatch = await account.comparePin(oldPin);
        console.log("oldPinMatch", oldPinMatch);

        if (!oldPinMatch) {
            return resp.status(400).json({ message: "Invalid old pin" });
        }

        account.pin = newPin;
        await account.save();
        console.log("account", account);
        return resp.status(200).json({
            message: "Pin Changed Successfully"
        });

    } catch (error) {
        console.error("[changePin]", error);
        return resp.status(500).json({
            statusCode: 500,
            status: "failed",
            message: "Internal server error",
        });
    }
}
async function getAccount(req, resp) {
    try {
        const user = req.user;
        const account = await accountModel
            .findOne({ user: user._id })
            .select('+pinAttempt +pinLockedUntil');
        if (!account) {
            return resp.status(400).json({
                statusCode: 400,
                status: "failed",
                message: "No Account available",
            })
        }

        // If the timed PIN lock has expired, restore ACTIVE status automatically.
        // Note: If you later add admin/security freezes, gate this by a freeze reason.
        if (
            account.status === 'FROZEN' &&
            account.pinLockedUntil &&
            account.pinLockedUntil <= new Date()
        ) {
            account.status = 'ACTIVE';
            account.pinAttempt = 0;
            account.pinLockedUntil = null;
            await account.save();
        }

        // Re-fetch without sensitive lock fields (select:false by default)
        const cleanAccount = await accountModel.findOne({ user: user._id });
        return resp.status(200).json({
            statusCode: 200,
            status: "success",
            message: "Account fetch Successfully",
            accounts: cleanAccount
        });
    } catch (error) {
        console.error("[getAccount]", error);
        return resp.status(500).json({
            statusCode: 500,
            status: "failed",
            message: "Internal server error",
        });
    }
}
async function getAccountBalance(req, resp) {
    try {

        const accountNumber = req.params.accountNumber;
        console.log("account number", accountNumber);

        const user = req.user;
        console.log("user", user);
        const isAccountExsist = await accountModel.findOne({
            accountNumber: accountNumber,
            user: user._id
        });
        console.log('isAccountExsist', isAccountExsist)
        if (!isAccountExsist) {
            return resp.status(404).json({ message: "Account not found" });
        }
        const balance = await isAccountExsist.getBalance();
        console.log("balance", balance);
        resp.status(200).json({ accountNumber, balance: balance });
    } catch (error) {
        console.error("[Initial Trasaction]", error);
        return resp.status(500).json({
            statusCode: 500,
            status: "failed",
            message: "Internal server error",
        });
    }
}
// Get Account /account/getRecipientAccount/:accountNumber
async function getRecipientAccount(req, res) {
    try {
        const { accountNumber } = req.params;
        const isAccountExsist = await accountModel.findOne({ accountNumber: accountNumber });
        if (!isAccountExsist) {
            return res.status(404).json({
                statusCode: 404,
                status: "failed",
                message: "Account not found",
            });
        }
        return res.status(200).json({
            statusCode: 200,
            status: "success",
            message: "Account fetch Successfully",
            accounts: isAccountExsist
        });

    }
    catch (error) {
        console.error("[Get Recipient Account]", error);
        return res.status(500).json({
            statusCode: 500,
            status: "failed",
            message: "Internal server error",
        });

    }
}

async function addBenificiary(req, resp) {
    try {
        const { accountNumber, nickname } = req.body ?? {};

        // 1. Find your own account
        const myAccount = await accountModel.findOne({ user: req.user._id });
        if (!myAccount) {
            return resp.status(404).json({ message: "Your account not found" });
        }

        // 2. Find the target account by accountNumber first
        const isAccountExsist = await accountModel.findOne({ accountNumber });
        if (!isAccountExsist) {
            return resp.status(404).json({ message: "Account not found" });
        }

        // 3. Self-add check
        if (String(isAccountExsist._id) === String(myAccount._id)) {
            return resp.status(400).json({ message: "You cannot add your own account as beneficiary" });
        }

        // 4. ✅ Now use ObjectId for duplicate check
        const alreadyAdded = await benificiaryModel.findOne({
            savedBy: myAccount._id,
            account: isAccountExsist._id
        });
        if (alreadyAdded) {
            return resp.status(400).json({ message: "Beneficiary already added" });
        }

        // 5. Create beneficiary
        await benificiaryModel.create({
            savedBy: myAccount._id,
            account: isAccountExsist._id,
            nickname
        });

        return resp.status(201).json({
            statusCode: 201,
            status: "success",
            message: "Beneficiary Added Successfully",
        });

    } catch (error) {
        console.error("[Add Benificiary]", error);
        return resp.status(500).json({
            statusCode: 500,
            status: "failed",
            message: "Internal server error",
        });
    }
}

async function deleteBenificiary(req, resp) {
    try {
        const { id } = req.params;

        // Find the user's account first
        const myAccount = await accountModel.findOne({ user: req.user._id });
        if (!myAccount) {
            return resp.status(404).json({ message: "Your account not found" });
        }

        // Now match using account._id, not user._id
        const deleted = await benificiaryModel.findOneAndDelete({
            _id: id,
            savedBy: myAccount._id  // ✅ correct
        });

        if (!deleted) {
            return resp.status(404).json({ message: "Beneficiary not found" });
        }

        return resp.status(200).json({ message: "Beneficiary deleted successfully" });

    } catch (error) {
        console.error("[Delete Benificiary]", error);
        return resp.status(500).json({
            statusCode: 500,
            status: "failed",
            message: "Internal server error",
        });
    }
}

async function getBenificiary(req, resp) {
    try {
        const myAccount = await accountModel.findOne({ user: req.user.id });

        const beneficiaries = await benificiaryModel.find({ savedBy: myAccount._id })
            .populate({
                path: 'account',
                select: 'accountNumber accountTitle',
                populate: {
                    path: 'user',
                    select: 'name email avatar'
                }
            });

        // Clean and shape the response
        const formattedBeneficiaries = beneficiaries.map(b => ({
            id: b._id,
            nickname: b.nickname,
            account_title: b.account.accountTitle,
            account_number: b.account.accountNumber,
            user_name: b.account.user.name,
            email: b.account.user.email,
            avatar: b.account.user.avatar
        }));

        return resp.status(200).json({
            statusCode: 200,
            status: "success",
            message: "Beneficiaries fetched successfully",
            beneficiaries: formattedBeneficiaries
        });

    } catch (error) {
        console.error("[Get Benificiary]", error);
        return resp.status(500).json({
            statusCode: 500,
            status: "failed",
            message: "Internal server error",
        });
    }
}

export {
    createAccount,
    getAccount,
    getAccountBalance,
    getRecipientAccount,
    changeAccountStatus,
    changePin,
    getBenificiary,
    addBenificiary,
    deleteBenificiary,
};