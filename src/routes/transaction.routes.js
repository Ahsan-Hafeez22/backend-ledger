import express from 'express';
import transactionController from '../controllers/transaction.controller.js';
import authMiddleware from '../middlewares/auth.middleware.js';

const router = express.Router();

router.post('/createTransaction', authMiddleware.authMiddleware, transactionController.createTransaction);
router.post('/initialFunds', authMiddleware.authSystemMiddleware, transactionController.createInitialFundTransaction);

export default router;
