import express from "express";
import authController from "../controllers/auth.controller.js";
import authMiddleware from "../middlewares/auth.middleware.js";
const router = express.Router();
import { validate } from "../middlewares/validation.middleware.js";
import {
    registerDto,
    verifyOtpDto,
    resendOtpDto,
    loginDto,
    refreshTokenDto,
    forgotPasswordDto,
    verifyResetOtpDto,
    resetPasswordDto,
    changePasswordDto,
} from "../validators/auth.validator.js";
import { otpLimiter, sensitiveLimiter } from "../middlewares/rateLimiter.js";

router.get("/user", authMiddleware.authMiddleware, authController.currentUser);
router.post("/register", validate(registerDto), authController.register);
router.post("/verify-otp", validate(verifyOtpDto), otpLimiter, authController.verifyOtp);
router.post("/resend-otp", validate(resendOtpDto), otpLimiter, authController.resendOtp);
router.post("/login", validate(loginDto), authController.login);
router.post("/logout", authMiddleware.authMiddleware, authController.logout);
router.post("/refresh-token", validate(refreshTokenDto), authController.refreshToken);
router.post("/forgot-password", validate(forgotPasswordDto), sensitiveLimiter, authController.forgotPassword);
router.post("/verify-reset-otp", validate(verifyResetOtpDto), otpLimiter, authController.verifyResetOtp);
router.post("/reset-password", validate(resetPasswordDto), sensitiveLimiter, authController.resetPassword);
router.post("/change-password", authMiddleware.authMiddleware, validate(changePasswordDto), sensitiveLimiter, authController.changePassword);
router.post("/google-auth", sensitiveLimiter, authController.googleAuth);
// router.post("/logout-all")
// router.post("/update-profile")
// router.post("/delete-account")
export default router;
