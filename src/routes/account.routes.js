import express from 'express';
import accountController from '../controllers/account.controller.js';
import authMiddleware from '../middlewares/auth.middleware.js';

const router = express.Router();


router.post('/create-account', authMiddleware.authMiddleware, accountController.createAccount);
router.get('/accounts', authMiddleware.authMiddleware, accountController.getAllAccounts);
router.get('/balance/:accountId', authMiddleware.authMiddleware, accountController.getAccountBalance);

export default router;
