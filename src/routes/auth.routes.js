import express from "express";
import authController from "../controllers/auth.controller.js";
import authMiddleware from "../middlewares/auth.middleware.js";
import { registerDto } from "../validators/auth.validator.js";
import { validate } from "../middlewares/validation.middleware.js";
const router = express.Router();


router.get("/user", validate(registerDto), authMiddleware.authMiddleware, authController.currentUser);
router.post("/register", authController.register);
router.post("/verify-otp", authController.verifyOtp);
router.post("/resend-otp", authController.resendOtp);

router.post("/login", authController.login);
router.post("/logout", authMiddleware.authMiddleware, authController.logout);
router.post("/refresh-token", authController.refreshToken);
router.post("/change-password", authMiddleware.authMiddleware, authController.changePassword);

router.post("/forgot-password", authController.forgotPassword);
router.post("/verify-reset-otp", authController.verifyResetOtp);
router.post("/reset-password", authController.resetPassword);

// router.post("/logout-all")
// router.post("/update-profile")

export default router;
