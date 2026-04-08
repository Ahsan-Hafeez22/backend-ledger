import express from 'express';
import transactionController from '../controllers/transaction.controller.js';
import authMiddleware from '../middlewares/auth.middleware.js';
import {
    createTransactionDTO,
    getTransactionsDTO,
    checkTransactionStatusDTO,
    transactionIdDTO,
    verifyPinDTO,
} from "../validators/transaction.validator.js";
import { validate } from "../middlewares/validation.middleware.js";

const router = express.Router();

// system only
router.post(
    '/initial-funds',
    authMiddleware.authSystemMiddleware,
    transactionController.createInitialFundTransaction
);

// user routes
router.post(
    '/create-transaction',
    authMiddleware.authMiddleware,
    validate(createTransactionDTO, 'body'),
    transactionController.createTransaction
);

router.post(
    '/verify-pin',
    authMiddleware.authMiddleware,
    validate(verifyPinDTO, 'body'),
    transactionController.verifyPin
)
router.get('/transactions',
    authMiddleware.authMiddleware,
    validate(getTransactionsDTO, 'query'),
    transactionController.getTransactions
);


router.get(
    '/check-status',
    authMiddleware.authMiddleware,
    validate(checkTransactionStatusDTO, 'query'),
    transactionController.getTransactionByIdempotencyKey
);

router.get(
    '/:transactionId',
    authMiddleware.authMiddleware,
    validate(transactionIdDTO, 'params'),
    transactionController.getTransactionDetail
);

export default router;

/*

router.post('/initial-funds', authMiddleware.authSystemMiddleware, transactionController.createInitialFundTransaction);
router.post('/create-transaction', authMiddleware.authMiddleware, transactionController.createTransaction);
router.get('/get-transactions/:transactionId', authMiddleware.authMiddleware, transactionController.getTransactionDetail);
router.get('/transactions', authMiddleware.authMiddleware, transactionController.getTransactions);
router.get('/check-status', authMiddleware.authMiddleware, transactionController.getTransactionByIdempotencyKey);

*/

// Pin verificaton added  if the user add 3 wrong pin the account will be FROZEN for one hour.