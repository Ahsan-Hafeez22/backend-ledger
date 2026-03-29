import express from 'express';
import authController from '../controllers/auth.controller.js';
import authMiddleware from '../middlewares/auth.middleware.js';

const router = express.Router();


router.post('/login', authController.userLoginController);
router.post('/register', authController.userRegisterController);
router.post('/refresh', authController.userRefreshController);
router.post('/logout', authMiddleware.authMiddleware, authController.userLogoutController);
router.post('/verifyOtp', authController.verifyOtpController);

export default router;
