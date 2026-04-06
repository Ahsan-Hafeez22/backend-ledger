import accountModel from '../models/account.model.js';
import bcrypt from 'bcrypt';



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
        const VALID_STATUSES = ['ACTIVE', 'CLOSED', 'FROZEN'];

        if (!VALID_STATUSES.includes(status)) {
            return resp.status(400).json({ message: "Invalid status" });
        }

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
        if (oldPin === newPin) {
            return resp.status(400).json({ message: "Old and new pin cannot be same" });
        }
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
        const account = await accountModel.findOne({ user: user._id });
        if (!account) {
            return resp.status(400).json({
                statusCode: 400,
                status: "failed",
                message: "No Account available",
            })
        }
        return resp.status(200).json({
            statusCode: 200,
            status: "success",
            message: "Account fetch Successfully",
            accounts: account
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
export default { createAccount, getAccount, getAccountBalance, changeAccountStatus, changePin };