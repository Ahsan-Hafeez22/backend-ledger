import mongoose from "mongoose";

import otpModel from "../models/otp.model.js";
import userModel from "../models/user.model.js";
import emailService from "../services/email.service.js";
import tokenBlackList from "../models/blacklist.model.js";
import refreshTokenModel from "../models/refresh.model.js";
import pendingUserModel from "../models/pending.user.model.js";
import {
    generateAccessToken,
    generateRefreshToken,
    hashToken,
    findRefreshToken,
} from "../utils/token.js";
import { generateOtp } from "../utils/utils.js";
import jwt from "jsonwebtoken";

async function userRegisterController(req, res) {
    try {
        const { email, name, password } = req.body;

        if (!email || !name || !password) {
            return res.status(400).json({
                statusCode: 400,
                status: "failed",
                message: "All fields are required",
            });
        }

        const userAlreadyExists = await userModel.findOne({ email }).lean();
        if (userAlreadyExists) {
            return res.status(422).json({
                statusCode: 422,
                status: "failed",
                message: "User already exists with this email",
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

        const rawOtp = generateOtp(); // your existing helper
        const otpHash = otpModel.hashOtp(rawOtp);

        // ── 5. Atomic invalidate old + insert new (race-condition safe)
        // Even if two requests pass step 3 simultaneously,
        // only one will cleanly create — the other will hit the
        // active OTP check on retry or get a stale read.
        // For true atomic safety we use a session.
        const session = await mongoose.startSession();

        try {
            await session.withTransaction(async () => {
                // store user in the Pending User Model
                await pendingUserModel.findOneAndUpdate(
                    { email },
                    {
                        email,
                        data: { name, password },
                        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
                    },
                    { upsert: true, session },
                );
                // Invalidate any lingering unused OTPs for this email
                await otpModel.updateMany(
                    { email, isUsed: false },
                    { isUsed: true },
                    { session },
                );

                // Insert the new OTP
                await otpModel.create(
                    [
                        {
                            email,
                            otpHash,
                            expiresAt: new Date(Date.now() + 2 * 60 * 1000),
                            pendingData: { name, email, password },
                        },
                    ],
                    { session },
                );
            });
        } finally {
            session.endSession();
        }

        // ── 6. Send email (await so we catch failures) ─────────────────
        try {
            const expiresAt = new Date(Date.now() + 2 * 60 * 1000);
            await emailService.sendOtpEmail(email, name, rawOtp, expiresAt);
        } catch (emailErr) {
            // Email failed — invalidate the OTP we just saved
            console.error(`Failed to send OTP email to ${email}:`, emailErr);
            await otpModel.updateMany({ email, isUsed: false }, { isUsed: true });
            return res.status(500).json({
                statusCode: 500,
                status: "failed",
                message: "Failed to send OTP email. Please try again.",
            });
        }

        // ── 7. Respond ─────────────────────────────────────────────────

        return res.status(200).json({
            statusCode: 200,
            status: "success",
            message: "OTP sent to your email. It expires in 2 minutes.",
        });
    } catch (error) {
        console.error("Register error:", error);
        return res.status(500).json({
            statusCode: 500,
            status: "failed",
            message: "Internal server error",
        });
    }
}
async function userLoginController(req, res) {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                statusCode: 400,
                status: "failed",
                message: "All fields are required",
            });
        }

        const user = await userModel.findOne({ email }).select("+password");
        if (!user) {
            return res.status(401).json({
                statusCode: 401,
                status: "failed",
                message: "Invalid Credentials",
            });
        }
        console.log(user);
        const isValidPassword = await user.comparePassword(password);
        if (!isValidPassword) {
            return res.status(401).json({
                statusCode: 401,
                status: "failed",
                message: "Invalid Password",
            });
        }

        const accessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken(user);
        const hashedRefreshToken = hashToken(refreshToken);
        console.log("hashedRefreshToken => ", hashedRefreshToken);
        await refreshTokenModel.create({
            userId: user._id,
            token: hashedRefreshToken,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        });

        return res.status(200).json({
            statusCode: 200,
            status: "success",
            message: "User Logged in successfully",
            user: {
                _id: user._id,
                email: user.email,
                name: user.name,
            },
            accessToken: accessToken,
            refreshToken: refreshToken,
        });
    } catch (error) {
        console.error("Login error:", error);
        return res.status(500).json({
            statusCode: 500,
            status: "failed",
            message: "Internal server error",
        });
    }
}
async function userLogoutController(req, res) {
    try {
        const token = req.cookies.token || req.headers.authorization?.split(" ")[1];

        if (!token) {
            return res.status(400).json({
                statusCode: 400,
                status: "failed",
                message: "User already logged out",
            });
        }

        await tokenBlackList.create({ token });
        console.log("After logout:", req.cookies.token);

        return res.status(200).json({
            statusCode: 200,
            status: "success",
            message: "User logged out Successfully",
        });
    } catch (error) {
        console.error("Logout error:", error);
        return res.status(500).json({
            statusCode: 500,
            status: "failed",
            message: "Internal server error",
        });
    }
}
async function userRefreshController(req, res) {
    try {
        const refreshToken = req.body.refreshToken;

        if (!refreshToken) {
            return res.status(400).json({
                status: "failed",
                message: "Empty: Provide Refresh Token!",
            });
        }

        const tokenInDB = await findRefreshToken(refreshToken);
        if (!tokenInDB) {
            return res.status(400).json({
                status: "failed",
                message: "Not in DB: Invalid refresh token!",
            });
        }
        let decodedToken;
        try {
            decodedToken = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
        } catch (e) {
            return res.status(400).json({
                status: "failed",
                message: "Decoded: Expired or invalid refresh token!",
            });
        }

        console.log(tokenInDB);
        const user = await userModel.findById(tokenInDB.userId);
        if (!user) {
            return res.status(400).json({
                status: "failed",
                message: "User not found against refresh token!",
            });
        }
        // DELETE old refresh token (rotation)
        await refreshTokenModel.deleteOne({ _id: tokenInDB._id });

        const newRefreshToken = generateRefreshToken(user);
        const hashed = hashToken(newRefreshToken);

        await refreshTokenModel.create({
            userId: user._id,
            token: hashed,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        });

        const accessToken = generateAccessToken(user);

        return res.status(200).json({
            status: "success",
            accessToken,
            refreshToken: newRefreshToken,
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            status: "failed",
            message: "Internal server error",
        });
    }
}
async function verifyOtpController(req, res) {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json({
                statusCode: 400,
                status: 'failed',
                message: 'Email and OTP are required',
            });
        }

        // ── 1. Find active OTP ────────────────────────────────────────
        const otpRecord = await otpModel.findActive(email);
        if (!otpRecord) {
            return res.status(400).json({
                statusCode: 400,
                status: 'failed',
                message: 'OTP expired or not found. Please request a new one.',
            });
        }

        // ── 2. Verify OTP hash ────────────────────────────────────────
        const otpHash = otpModel.hashOtp(otp);
        if (otpHash !== otpRecord.otpHash) {
            return res.status(400).json({
                statusCode: 400,
                status: 'failed',
                message: 'Invalid OTP.',
            });
        }

        // ── 3. Get pending user data ───────────────────────────────────
        const pendingUser = await pendingUserModel.findOne({ email });
        if (!pendingUser) {
            return res.status(400).json({
                statusCode: 400,
                status: 'failed',
                // Pending doc expired (10 min) but OTP was still valid (2 min)
                message: 'Registration session expired. Please register again.',
            });
        }

        // ── 4. Atomically create user + clean up ──────────────────────
        const session = await mongoose.startSession();
        let newUser;

        try {
            await session.withTransaction(async () => {
                // Mark OTP as used
                await otpModel.findByIdAndUpdate(
                    otpRecord._id,
                    { isUsed: true },
                    { session }
                );

                // Create the real user from pending data
                [newUser] = await userModel.create(
                    [{ email, verified: true, name: pendingUser.data.name, password: pendingUser.data.password }],
                    { session }
                );

                // Delete pending record
                await pendingUserModel.deleteOne({ email }, { session });
            });
        } finally {
            session.endSession();
        }

        // ── 5. Generate tokens & respond ──────────────────────────────
        const accessToken = generateAccessToken(newUser);
        const refreshToken = generateRefreshToken(newUser);

        return res.status(201).json({
            statusCode: 201,
            status: 'success',
            message: 'Account created successfully.',
            user: {
                _id: user._id,
                email: user.email,
                name: user.name,
            },
            accessToken: accessToken,
            refreshToken: refreshToken,
        });

    } catch (error) {
        console.error('Verify OTP error:', error);
        return res.status(500).json({
            statusCode: 500,
            status: 'failed',
            message: 'Internal server error',
        });
    }
}
export default {
    userRegisterController,
    userLoginController,
    userLogoutController,
    userRefreshController,
    verifyOtpController,
};
