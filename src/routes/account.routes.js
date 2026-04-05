import express from 'express';
import accountController from '../controllers/account.controller.js';
import authMiddleware from '../middlewares/auth.middleware.js';
import { sensitiveLimiter } from "../middlewares/rateLimiter.js";
import { validate } from "../middlewares/validation.middleware.js";
import {
    createAccountDTO
} from "../validators/account.validator.js";

const router = express.Router();


router.post('/create-account', authMiddleware.authMiddleware, validate(createAccountDTO), sensitiveLimiter, accountController.createAccount);
router.get('/account', authMiddleware.authMiddleware, sensitiveLimiter, accountController.getAccount);
router.get('/balance/:accountId', authMiddleware.authMiddleware, sensitiveLimiter, accountController.getAccountBalance);

export default router;
