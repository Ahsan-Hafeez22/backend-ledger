const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transaction.controller');
const authMiddleware = require('../middlewares/auth.middleware');


router.post('/createTransaction', authMiddleware.authMiddleware, transactionController.createTransaction);
router.post('/initialFunds', authMiddleware.authSystemMiddleware, transactionController.createInitialFundTransaction);


module.exports = router;