const accountModel = require('../models/account.model');


async function createAccount(req, resp) {
    try {
        const user = req.user;
        const account = await accountModel.create({ user: user._id });
        return resp.status(201).json(account);
    } catch (error) {
        return resp.status(500).json({ message: error.message });
    }
}

module.exports = { createAccount };