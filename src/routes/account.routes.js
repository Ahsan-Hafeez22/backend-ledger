const express = require('express');
const router = express.Router();
const accountController = require('../controllers/account.controller');
const authMiddleware = require('../middlewares/auth.middleware');

router.post('/create-account', authMiddleware.authMiddleware, accountController.createAccount);
router.get('/accounts', authMiddleware.authMiddleware, accountController.getAllAccounts);
router.get('/balance/:accountId', authMiddleware.authMiddleware, accountController.getAccountBalance);

module.exports = router;