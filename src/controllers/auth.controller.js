import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import "dotenv/config";
import otpModel from "../models/otp.model.js";
import userModel from "../models/user.model.js";
import emailService from "../services/email.service.js";
import googleAuthService from "../services/google.auth.service.js";
import tokenBlackList from "../models/blacklist.model.js";
import refreshTokenModel from "../models/refresh.model.js";
import pendingUserModel from "../models/pendingUser.model.js";
import authUtils from "../utils/auth.utils.js";
// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/register
// Body: { email, name, password, ...anyExtraFields }
// Creates a pendingUser and sends an OTP to verify email ownership.
// ─────────────────────────────────────────────────────────────────────────────

async function register(req, res) {
    try {
        const {
            email,
            name,
            password,
            phone,
            dateOfBirth,
            country,
            defaultCurrency,
            role,
        } = req.body;

        const userAlreadyExists = await userModel.findOne({ email }).lean();
        if (userAlreadyExists) {
            return res.status(422).json({
                statusCode: 422,
                status: "failed",
                message: "An account with this email already exists",
            });
        }

        const activeOtp = await otpModel.findActive(email);
        if (activeOtp) {
            const secondsLeft = Math.ceil((activeOtp.expiresAt - Date.now()) / 1000);
            return res.status(429).json({
                statusCode: 429,
                status: "failed",
                message: `OTP already sent. Please wait ${secondsLeft} seconds before requesting a new one.`,
                retryAfterSeconds: secondsLeft,
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const rawOtp = authUtils.generateOtp();
        const otpHash = otpModel.hashOtp(rawOtp);
        const otpExpiresAt = new Date(Date.now() + 2 * 60 * 1000); // 2 min
        const pendingExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min

        const session = await mongoose.startSession();
        try {
            await session.withTransaction(async () => {
                await pendingUserModel.findOneAndUpdate(
                    { email },
                    {
                        email,
                        data: {
                            name,
                            password: hashedPassword,
                            phone,
                            dateOfBirth,
                            country,
                            defaultCurrency,
                            role,
                        },
                        expiresAt: pendingExpiresAt,
                    },
                    { upsert: true, session },
                );

                await otpModel.updateMany(
                    { email, isUsed: false },
                    { isUsed: true },
                    { session },
                );

                await otpModel.create(
                    [{ email, otpHash, expiresAt: otpExpiresAt, type: "registration" }],
                    { session },
                );
            });
        } finally {
            session.endSession();
        }

        try {
            await emailService.sendOtpEmail(email, name, rawOtp, otpExpiresAt);
        } catch (emailErr) {
            console.error(
                `[register] Failed to send OTP email to ${email}:`,
                emailErr,
            );
            await otpModel.updateMany({ email, isUsed: false }, { isUsed: true });
            return res.status(500).json({
                statusCode: 500,
                status: "failed",
                message: "Failed to send OTP email. Please try again.",
            });
        }

        return res.status(200).json({
            statusCode: 200,
            status: "success",
            message: "OTP sent to your email. It expires in 2 minutes.",
        });
    } catch (error) {
        console.error("[register]", error);
        return res.status(500).json({
            statusCode: 500,
            status: "failed",
            message: "Internal server error",
        });
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/verify-otp
// Body: { email, otp }
// Verifies the registration OTP, creates the real user, returns auth tokens.
// ─────────────────────────────────────────────────────────────────────────────
async function verifyOtp(req, res) {
    try {
        const { email, otp } = req.body;

        // Find a valid, unused registration OTP
        const otpRecord = await otpModel.findActive(email, "registration");
        if (!otpRecord) {
            return res.status(400).json({
                statusCode: 400,
                status: "failed",
                message: "OTP expired or not found. Please request a new one.",
            });
        }

        if (otpRecord.otpHash !== otpModel.hashOtp(otp)) {
            return res.status(400).json({
                statusCode: 400,
                status: "failed",
                message: "Invalid OTP.",
            });
        }
        // console.log("otpRecord", otpRecord);

        // Ensure the pending registration data still exists (10-min window)
        const pendingUser = await pendingUserModel.findOne({ email });
        if (!pendingUser) {
            return res.status(400).json({
                statusCode: 400,
                status: "failed",
                message: "Registration session expired. Please register again.",
            });
        }

        // Atomically create user, mark OTP used, delete pending record
        const session = await mongoose.startSession();
        let newUser;
        try {
            await session.withTransaction(async () => {
                await otpModel.findByIdAndUpdate(
                    otpRecord._id,
                    { isUsed: true },
                    { session },
                );

                [newUser] = await userModel.create(
                    [
                        {
                            email,
                            verified: true,
                            name: pendingUser.data.name,
                            password: pendingUser.data.password,
                            phone: pendingUser.data.phone,
                            dateOfBirth: pendingUser.data.dateOfBirth,
                            country: pendingUser.data.country,
                            defaultCurrency: pendingUser.data.defaultCurrency,
                            role: pendingUser.data.role,
                            type: pendingUser.data.type,
                            status: "active",
                            emailVerifiedAt: new Date(),
                        },
                    ],
                    { session },
                );

                await pendingUserModel.deleteOne({ email }, { session });
            });
        } finally {
            session.endSession();
        }

        const accessToken = authUtils.generateAccessToken(newUser);
        const refreshToken = authUtils.generateRefreshToken(newUser);

        await refreshTokenModel.create({
            userId: newUser._id,
            token: authUtils.hashToken(refreshToken),
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        });

        return res.status(201).json({
            statusCode: 201,
            status: "success",
            message: "Account created successfully.",
            user: newUser,
            accessToken,
            refreshToken,
        });
    } catch (error) {
        console.error("[Google]", error);
        return res.status(500).json({
            statusCode: 500,
            status: "failed",
            message: "Internal server error",
        });
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/google
// Body: { idToken }
// Verifies the id token, creates the real user using the google auth, returns user.
// ─────────────────────────────────────────────────────────────────────────────
async function googleAuth(req, res) {
    try {
        const { idToken } = req.body;

        if (!idToken) {
            return res.status(400).json({
                statusCode: 400,
                status: "failed",
                message: "Id Token is required",
            });
        }

        let googleProfile;
        try {
            googleProfile = await googleAuthService.verifyGoogleToken(idToken);
        } catch (e) {
            return res.status(400).json({
                statusCode: 400,
                status: "failed",
                message: "Invalid Id Token",
            });

        }
        console.log("googleProfile", googleProfile);

        const { user, isNewUser, isGoogleLinked } = await googleAuthService.findOrCreateGoogleUser(googleProfile);
        console.log("Google User", user);

        const accessToken = authUtils.generateAccessToken(user);
        const refreshToken = authUtils.generateRefreshToken(user);

        await refreshTokenModel.create({
            userId: user._id,
            token: authUtils.hashToken(refreshToken),
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        });
        const message = isNewUser
            ? "Account created successfully." :
            isGoogleLinked ? "Google account linked successfully." :
                "Google account linked successfully.";

        return res.status(isNewUser ? 201 : 200).json({
            statusCode: isNewUser ? 201 : 200,
            status: 'success',
            message,
            isNewUser,
            isGoogleLinked: isGoogleLinked ?? false,
            user,
            accessToken,
            refreshToken,

        });
    } catch (error) {
        console.error("[Google Auth]", error);
        return res.status(500).json({
            statusCode: 500,
            status: "failed",
            message: "Internal server error",
        });
    }
}


// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/resend-otp
// Body: { email }
// Resends a registration OTP — pendingUser must already exist.
// ─────────────────────────────────────────────────────────────────────────────
async function resendOtp(req, res) {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                statusCode: 400,
                status: "failed",
                message: "Email is required",
            });
        }

        const userAlreadyExists = await userModel.findOne({ email }).lean();
        if (userAlreadyExists) {
            return res.status(422).json({
                statusCode: 422,
                status: "failed",
                message: "An account with this email already exists",
            });
        }

        // Must have a pending registration — otherwise nothing to resend for
        const pendingUser = await pendingUserModel.findOne({ email }).lean();
        if (!pendingUser) {
            return res.status(400).json({
                statusCode: 400,
                status: "failed",
                message: "No pending registration found. Please register first.",
            });
        }

        // Rate-limit
        const activeOtp = await otpModel.findActive(email, "registration");
        if (activeOtp) {
            const secondsLeft = Math.ceil((activeOtp.expiresAt - Date.now()) / 1000);
            return res.status(429).json({
                statusCode: 429,
                status: "failed",
                message: `OTP already sent. Please wait ${secondsLeft} seconds.`,
                retryAfterSeconds: secondsLeft,
            });
        }

        const rawOtp = authUtils.generateOtp();
        const otpHash = otpModel.hashOtp(rawOtp);
        const otpExpiresAt = new Date(Date.now() + 2 * 60 * 1000);

        const session = await mongoose.startSession();
        try {
            await session.withTransaction(async () => {
                await otpModel.updateMany(
                    { email, isUsed: false },
                    { isUsed: true },
                    { session },
                );
                await otpModel.create(
                    [{ email, otpHash, expiresAt: otpExpiresAt, type: "registration" }],
                    { session },
                );
            });
        } finally {
            session.endSession();
        }

        try {
            await emailService.sendOtpEmail(
                email,
                pendingUser.data.name,
                rawOtp,
                otpExpiresAt,
            );
        } catch (emailErr) {
            console.error(
                `[resendOtp] Failed to send OTP email to ${email}:`,
                emailErr,
            );
            await otpModel.updateMany({ email, isUsed: false }, { isUsed: true });
            return res.status(500).json({
                statusCode: 500,
                status: "failed",
                message: "Failed to send OTP email. Please try again.",
            });
        }

        return res.status(200).json({
            statusCode: 200,
            status: "success",
            message: "OTP resent to your email. It expires in 2 minutes.",
        });
    } catch (error) {
        console.error("[resendOtp]", error);
        return res.status(500).json({
            statusCode: 500,
            status: "failed",
            message: "Internal server error",
        });
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/login
// Body: { email, password }
// ─────────────────────────────────────────────────────────────────────────────
async function login(req, res) {
    try {
        const { email, password } = req.body;


        const user = await userModel.findOne({ email }).select("+password");
        if (!user) {
            return res.status(401).json({
                statusCode: 401,
                status: "failed",
                message: "Invalid credentials",
            });
        }
        if (user.googleId != null && user.password == null) {
            return res.status(401).json({
                statusCode: 401,
                status: "failed",
                message: "This account is associated with the google, try login using Google",
            });

        }
        console.log("user", user);
        const isValidPassword = await user.comparePassword(password);
        if (!isValidPassword) {
            return res.status(401).json({
                statusCode: 401,
                status: "failed",
                message: "Invalid credentials: Password",
            });
        }

        const accessToken = authUtils.generateAccessToken(user);
        const refreshToken = authUtils.generateRefreshToken(user);

        await refreshTokenModel.create({
            userId: user._id,
            token: authUtils.hashToken(refreshToken),
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        });

        return res.status(200).json({
            statusCode: 200,
            status: "success",
            message: "Logged in successfully",
            user: user,
            accessToken,
            refreshToken,
        });
    } catch (error) {
        console.error("[login]", error);
        return res.status(500).json({
            statusCode: 500,
            status: "failed",
            message: "Internal server error",
        });
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /auth/user
// find the user on the basis of token
// ─────────────────────────────────────────────────────────────────────────────
async function currentUser(req, res) {
    try {
        const user = req.user;
        return res.status(200).json({
            statusCode: 200,
            status: "success",
            user: user,
        });
    } catch (error) {
        console.error("[getUser]", error);
        return res.status(500).json({
            statusCode: 500,
            status: "failed",
            message: "Internal server error",
        });
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/logout
// Headers: Authorization: Bearer <accessToken>
// Blacklists the access token.
// ─────────────────────────────────────────────────────────────────────────────
async function logout(req, res) {
    try {
        const token = req.headers.authorization?.split(" ")[1];

        if (!token) {
            return res.status(400).json({
                statusCode: 400,
                status: "failed",
                message: "No token provided",
            });
        }

        await tokenBlackList.create({ token });

        return res.status(200).json({
            statusCode: 200,
            status: "success",
            message: "Logged out successfully",
        });
    } catch (error) {
        console.error("[logout]", error);
        return res.status(500).json({
            statusCode: 500,
            status: "failed",
            message: "Internal server error",
        });
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/refresh-token
// Body: { refreshToken }
// Rotates the refresh token and issues a new access token.
// ─────────────────────────────────────────────────────────────────────────────
async function refreshToken(req, res) {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(400).json({
                statusCode: 400,
                status: "failed",
                message: "Refresh token is required",
            });
        }

        const tokenInDB = await authUtils.findRefreshToken(refreshToken);
        if (!tokenInDB) {
            return res.status(401).json({
                statusCode: 401,
                status: "failed",
                message: "Invalid refresh token",
            });
        }

        let decoded;
        try {
            decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
        } catch {
            return res.status(401).json({
                statusCode: 401,
                status: "failed",
                message: "Refresh token expired or invalid",
            });
        }

        const user = await userModel.findById(decoded.userId ?? tokenInDB.userId);
        if (!user) {
            return res.status(404).json({
                statusCode: 404,
                status: "failed",
                message: "User not found",
            });
        }

        // Rotate: delete old, issue new
        await refreshTokenModel.deleteOne({ _id: tokenInDB._id });

        const newRefreshToken = authUtils.generateRefreshToken(user);
        const newAccessToken = authUtils.generateAccessToken(user);

        await refreshTokenModel.create({
            userId: user._id,
            token: authUtils.hashToken(newRefreshToken),
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        });

        return res.status(200).json({
            statusCode: 200,
            status: "success",
            accessToken: newAccessToken,
            refreshToken: newRefreshToken,
        });
    } catch (error) {
        console.error("[refreshToken]", error);
        return res.status(500).json({
            statusCode: 500,
            status: "failed",
            message: "Internal server error",
        });
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/forgot-password
// Body: { email }
// Sends a password-reset OTP to the given email.
// ─────────────────────────────────────────────────────────────────────────────
async function forgotPassword(req, res) {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                statusCode: 400,
                status: "failed",
                message: "Email is required",
            });
        }

        const user = await userModel.findOne({ email }).lean();
        if (!user) {
            // Return 200 intentionally — do not reveal whether the email exists
            return res.status(200).json({
                statusCode: 200,
                status: "success",
                message: "If an account with that email exists, an OTP has been sent.",
            });
        }

        // Rate-limit
        const activeOtp = await otpModel.findActive(email, "forgot_password");
        if (activeOtp) {
            const secondsLeft = Math.ceil((activeOtp.expiresAt - Date.now()) / 1000);
            return res.status(429).json({
                statusCode: 429,
                status: "failed",
                message: `OTP already sent. Please wait ${secondsLeft} seconds before requesting a new one.`,
                retryAfterSeconds: secondsLeft,
            });
        }

        const rawOtp = authUtils.generateOtp();
        const otpHash = otpModel.hashOtp(rawOtp);
        const otpExpiresAt = new Date(Date.now() + 2 * 60 * 1000);

        const session = await mongoose.startSession();
        try {
            await session.withTransaction(async () => {
                await otpModel.updateMany(
                    { email, isUsed: false },
                    { isUsed: true },
                    { session },
                );
                await otpModel.create(
                    [
                        {
                            email,
                            otpHash,
                            expiresAt: otpExpiresAt,
                            type: "forgot_password",
                        },
                    ],
                    { session },
                );
            });
        } finally {
            session.endSession();
        }

        try {
            await emailService.sendOtpEmail(email, user.name, rawOtp, otpExpiresAt);
        } catch (emailErr) {
            console.error(
                `[forgotPassword] Failed to send OTP to ${email}:`,
                emailErr,
            );
            await otpModel.updateMany({ email, isUsed: false }, { isUsed: true });
            return res.status(500).json({
                statusCode: 500,
                status: "failed",
                message: "Failed to send OTP email. Please try again.",
            });
        }

        return res.status(200).json({
            statusCode: 200,
            status: "success",
            message: "If an account with that email exists, an OTP has been sent.",
        });
    } catch (error) {
        console.error("[forgotPassword]", error);
        return res.status(500).json({
            statusCode: 500,
            status: "failed",
            message: "Internal server error",
        });
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/verify-reset-otp
// Body: { email, otp }
// Verifies the forgot-password OTP and returns a short-lived resetToken.
// The resetToken is REQUIRED to call /reset-password — without it anyone
// with an email address could reset another user's password.
// ─────────────────────────────────────────────────────────────────────────────
async function verifyResetOtp(req, res) {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json({
                statusCode: 400,
                status: "failed",
                message: "Email and OTP are required",
            });
        }

        const user = await userModel.findOne({ email }).lean();
        if (!user) {
            return res.status(404).json({
                statusCode: 404,
                status: "failed",
                message: "No account found with this email",
            });
        }

        const otpRecord = await otpModel.findActive(email, "forgot_password");
        if (!otpRecord) {
            return res.status(400).json({
                statusCode: 400,
                status: "failed",
                message: "OTP expired or not found. Please request a new one.",
            });
        }

        if (otpRecord.otpHash !== otpModel.hashOtp(otp)) {
            return res.status(400).json({
                statusCode: 400,
                status: "failed",
                message: "Invalid OTP.",
            });
        }

        // Invalidate OTP — it has served its purpose
        await otpModel.findByIdAndUpdate(otpRecord._id, { isUsed: true });

        // Issue a short-lived reset token as proof that OTP was verified.
        // /reset-password will only work if this token is present and valid.
        const resetToken = jwt.sign(
            { userId: user._id, purpose: "reset_password" },
            process.env.JWT_REFRESH_SECRET,
            { expiresIn: "10m" },
        );

        return res.status(200).json({
            statusCode: 200,
            status: "success",
            message: "OTP verified. You have 10 minutes to reset your password.",
            resetToken,
        });
    } catch (error) {
        console.error("[verifyResetOtp]", error);
        return res.status(500).json({
            statusCode: 500,
            status: "failed",
            message: "Internal server error",
        });
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/reset-password
// Body: { resetToken, password }
// Resets the password. Requires the resetToken issued by /verify-reset-otp.
// Also invalidates all existing refresh tokens (forces re-login on all devices).
// ─────────────────────────────────────────────────────────────────────────────
async function resetPassword(req, res) {
    try {
        const { resetToken, password } = req.body;

        if (!resetToken || !password) {
            return res.status(400).json({
                statusCode: 400,
                status: "failed",
                message: "Reset token and new password are required",
            });
        }

        // Verify the reset token — proves /verify-reset-otp was called successfully
        let decoded;
        try {
            decoded = jwt.verify(resetToken, process.env.JWT_REFRESH_SECRET);
        } catch (err) {
            return res.status(400).json({
                statusCode: 400,
                status: "failed",
                message:
                    err.name === "TokenExpiredError"
                        ? "Reset session expired. Please request a new OTP."
                        : "Invalid reset token.",
            });
        }

        if (decoded.purpose !== "reset_password") {
            return res.status(400).json({
                statusCode: 400,
                status: "failed",
                message: "Invalid reset token.",
            });
        }

        const user = await userModel.findById(decoded.userId).select("+password");
        if (!user) {
            return res.status(404).json({
                statusCode: 404,
                status: "failed",
                message: "User not found",
            });
        }

        // Prevent reusing the same password
        const isSamePassword = await bcrypt.compare(password, user.password);
        if (isSamePassword) {
            return res.status(400).json({
                statusCode: 400,
                status: "failed",
                message: "New password cannot be the same as your current password.",
            });
        }

        user.password = await bcrypt.hash(password, 10);
        await user.save();

        // Invalidate all refresh tokens — forces re-login on every device
        await refreshTokenModel.deleteMany({ userId: user._id });

        return res.status(200).json({
            statusCode: 200,
            status: "success",
            message:
                "Password reset successfully. Please log in with your new password.",
        });
    } catch (error) {
        console.error("[resetPassword]", error);
        return res.status(500).json({
            statusCode: 500,
            status: "failed",
            message: "Internal server error",
        });
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /auth/change-password
// Body: { oldPassword, newPassword }
// Resets the password. Requires the oldPassword and newPassword.
// Also matches if the old password matches with the current password.
// ─────────────────────────────────────────────────────────────────────────────
async function changePassword(req, res) {
    try {
        const { oldPassword, newPassword } = req.body;
        if (!oldPassword || !newPassword) {
            return res.status(400).json({
                statusCode: 400,
                status: "failed",
                message: "old password and new password are required",
            });
        }

        const token = req.headers.authorization?.split(" ")[1] || "";
        if (!token) {
            return res.status(401).json({
                statusCode: 401,
                status: "failed",
                message: "Unauthorized",
            });
        }
        const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

        const user = await userModel.findById(decoded.userId).select("+password");
        if (!user) {
            return res.status(401).json({
                statusCode: 400,
                status: "failed",
                message: "User not found",
            });
        }

        const isValidPassword = await user.comparePassword(oldPassword);
        if (!isValidPassword) {
            return res.status(400).json({
                statusCode: 400,
                status: "failed",
                message: "Old Password do not matches with your current password",
            });
        }
        // Prevent reusing the same password
        const isSamePassword = await bcrypt.compare(newPassword, user.password);
        if (isSamePassword) {
            return res.status(400).json({
                statusCode: 400,
                status: "failed",
                message: "New password cannot be the same as your current password.",
            });
        }

        user.password = await bcrypt.hash(newPassword, 10);
        await user.save();

        return res.status(200).json({
            statusCode: 200,
            status: "success",
            message: "Password changed successfully.",
        });
    } catch (error) {
        console.error("[changePassword]", error);
        return res.status(500).json({
            statusCode: 500,
            status: "failed",
            message: "Internal server error",
        });
    }
}

export default {
    currentUser,
    register,
    login,
    logout,
    refreshToken,
    verifyOtp,
    resendOtp,
    forgotPassword,
    verifyResetOtp,
    resetPassword,
    changePassword,
    googleAuth
};
