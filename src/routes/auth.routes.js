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


router.get("/user", authMiddleware.authMiddleware, authController.currentUser);
router.post("/register", validate(registerDto), authController.register);
router.post("/verify-otp", validate(verifyOtpDto), authController.verifyOtp);
router.post("/resend-otp", validate(resendOtpDto), authController.resendOtp);
router.post("/login", validate(loginDto), authController.login);
router.post("/logout", authMiddleware.authMiddleware, authController.logout);
router.post("/refresh-token", validate(refreshTokenDto), authController.refreshToken);
router.post("/change-password", authMiddleware.authMiddleware, validate(changePasswordDto), authController.changePassword);
router.post("/forgot-password", validate(forgotPasswordDto), authController.forgotPassword);
router.post("/verify-reset-otp", validate(verifyResetOtpDto), authController.verifyResetOtp);
router.post("/reset-password", validate(resetPasswordDto), authController.resetPassword);

// router.post("/logout-all")
// router.post("/update-profile")

export default router;
