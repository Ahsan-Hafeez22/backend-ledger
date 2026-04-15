import express from 'express';
import * as accountController from '../controllers/account.controller.js';
import authMiddleware from '../middlewares/auth.middleware.js';
import { sensitiveLimiter } from "../middlewares/rateLimiter.js";
import { validate } from "../middlewares/validation.middleware.js";
import {
    createAccountDTO,
    changePinDTO,
    changeAccountStatusParamsDTO,
    accountNumberParamsDTO
} from "../validators/account.validator.js";

const router = express.Router();

router.post('/create-account', authMiddleware.authMiddleware, validate(createAccountDTO), sensitiveLimiter, accountController.createAccount);
router.patch('/change-account-status/:status', authMiddleware.authMiddleware, validate(changeAccountStatusParamsDTO, 'params'), sensitiveLimiter, accountController.changeAccountStatus);
router.get('/account', authMiddleware.authMiddleware, sensitiveLimiter, accountController.getAccount);
router.get('/balance/:accountNumber', authMiddleware.authMiddleware, validate(accountNumberParamsDTO, 'params'), sensitiveLimiter, accountController.getAccountBalance);
router.post('/change-pin', authMiddleware.authMiddleware, validate(changePinDTO), sensitiveLimiter, accountController.changePin);

export default router;
