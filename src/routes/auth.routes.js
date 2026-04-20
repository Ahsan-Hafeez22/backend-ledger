import express from "express";
import * as authController from "../controllers/auth.controller.js";
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
    registerDeviceDto,
    logoutDto
} from "../validators/auth.validator.js";
import { otpLimiter, sensitiveLimiter } from "../middlewares/rateLimiter.js";
import { uploadAvatar } from "../middlewares/upload.middleware.js";


router.get("/user", authMiddleware.authMiddleware, authController.currentUser);
router.post("/register", validate(registerDto), authController.register);
router.post("/verify-otp", validate(verifyOtpDto), otpLimiter, authController.verifyOtp);
router.post("/resend-otp", validate(resendOtpDto), otpLimiter, authController.resendOtp);
router.post("/login", validate(loginDto), authController.login);
router.post("/logout", authMiddleware.authMiddleware, validate(logoutDto), authController.logout);
router.post("/logout-all-devices", authMiddleware.authMiddleware, authController.logoutAllDevices);
router.post("/refresh-token", validate(refreshTokenDto), authController.refreshToken);
router.post("/forgot-password", validate(forgotPasswordDto), sensitiveLimiter, authController.forgotPassword);
router.post("/verify-reset-otp", validate(verifyResetOtpDto), otpLimiter, authController.verifyResetOtp);
router.post("/reset-password", validate(resetPasswordDto), sensitiveLimiter, authController.resetPassword);
router.post("/change-password", authMiddleware.authMiddleware, validate(changePasswordDto), sensitiveLimiter, authController.changePassword);
router.post("/google-auth", sensitiveLimiter, authController.googleAuth);
router.delete("/delete-user", sensitiveLimiter, authController.deleteAccount);
router.post("/register-device", sensitiveLimiter, validate(registerDeviceDto), authMiddleware.authMiddleware, authController.registerDevice);
router.get("/get-registered-device", sensitiveLimiter, authMiddleware.authMiddleware, authController.getUserDevices);
router.patch(
    "/profile",
    authMiddleware.authMiddleware,
    sensitiveLimiter,
    uploadAvatar,
    authController.editProfile
);

// router.post("/logout-all")
// router.post("/update-profile")
export default router;
