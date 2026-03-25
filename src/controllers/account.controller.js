import accountModel from '../models/account.model.js';

async function createAccount(req, resp) {
    try {
        const user = req.user;
        const account = await accountModel.create({ user: user._id });
        return resp.status(201).json(account);
    } catch (error) {
        return resp.status(500).json({ message: error.message });
    }
}
async function getAllAccounts(req, resp) {
    try {
        const user = req.user;
        const accounts = await accountModel.find({ user: user._id });
        return resp.status(200).json({ accounts: accounts });
    } catch (error) {
        return resp.status(500).json({ message: error.message });
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
export default { createAccount, getAllAccounts, getAccountBalance };