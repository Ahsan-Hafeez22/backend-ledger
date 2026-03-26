import userModel from "../models/user.model.js";
import emailService from "../services/email.service.js";
import tokenBlackList from "../models/blacklist.model.js";
import refreshTokenModel from "../models/refresh.model.js";
import {
    generateAccessToken,
    generateRefreshToken,
    hashToken,
    findRefreshToken,
} from "../utils/token.js";
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

        const userAlreadyExists = await userModel.findOne({ email });
        if (userAlreadyExists) {
            return res.status(422).json({
                statusCode: 422,
                status: "failed",
                message: "User already exists with this email",
            });
        }
        const user = await userModel.create({ email, name, password });

        const accessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken(user);
        const hashedRefreshToken = hashToken(refreshToken);

        await refreshTokenModel.create({
            userId: user._id,
            token: hashedRefreshToken,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        });

        emailService
            .sendRegistrationEmail(user.email, user.name)
            .catch((err) => console.error("Error sending registration email:", err));

        return res.status(201).json({
            statusCode: 201,
            status: "success",
            message: "User registered successfully",
            user: {
                _id: user._id,
                email: user.email,
                name: user.name,
            },
            accessToken: accessToken,
            refreshToken: refreshToken,
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
export default {
    userRegisterController,
    userLoginController,
    userLogoutController,
    userRefreshController,
};
