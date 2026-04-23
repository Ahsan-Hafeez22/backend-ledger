import express from 'express';
import * as transactionController from '../controllers/transaction.controller.js';
import authMiddleware from '../middlewares/auth.middleware.js';
import {
    createTransactionDTO,
    getTransactionsDTO,
    checkTransactionStatusDTO,
    transactionIdDTO,
    verifyPinDTO,
    createInitialFundsDTO,
} from "../validators/transaction.validator.js";
import { validate } from "../middlewares/validation.middleware.js";

const router = express.Router();

// system only
router.post(
    '/initial-funds',
    authMiddleware.authSystemMiddleware,
    validate(createInitialFundsDTO, 'body'),
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
);
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

// Pin verificaton added  if the user add 3 wrong pin the account will be FROZEN for one hour.