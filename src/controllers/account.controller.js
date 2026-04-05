import accountModel from '../models/account.model.js';

async function createAccount(req, resp) {
    try {
        const { accountTitle, pin } = req.body;
        const user = req.user;

        const accountAlreadyExists = await accountModel.findOne({ user: user._id }).lean();
        const account = await accountModel.create({ user: user._id, accountTitle, pin });
        if (accountAlreadyExists) {
            return resp.status(422).json({
                statusCode: 422,
                status: "failed",
                message: "An account with this title already exists",
            });
        }
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

        const accountId = req.params.accountId;
        console.log("account ID", accountId);

        const user = req.user;
        console.log("user", user);
        const isAccountExsist = await accountModel.findOne({
            _id: accountId,
            user: user._id
        });
        console.log('isAccountExsist', isAccountExsist)
        if (!isAccountExsist) {
            return resp.status(404).json({ message: "Account not found" });
        }
        const balance = await isAccountExsist.getBalance();
        console.log("balance", balance);
        resp.status(200).json({ accountId: accountId, balance: balance });
    } catch (error) {
        return resp.status(500).json({ message: error.message });
    }
}
export default { createAccount, getAccount, getAccountBalance };