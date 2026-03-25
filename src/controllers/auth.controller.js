import userModel from '../models/user.model.js';
import jwt from 'jsonwebtoken';
import emailService from '../services/email.service.js';
import tokenBlackList from '../models/blacklist.model.js';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import refreshTokenModel from '../models/refresh.model.js';
import { generateAccessToken, generateRefreshToken, hashToken } from "../utils/token.js";

async function userRegisterController(req, res) {
    try {
        const { email, name, password } = req.body;

        if (!email || !name || !password) {
            return res.status(400).json({
                statusCode: 400,
                status: 'failed',
                message: "All fields are required"
            });
        }

        const userAlreadyExists = await userModel.findOne({ email });
        if (userAlreadyExists) {
            return res.status(422).json({
                statusCode: 422,
                status: 'failed',
                message: "User already exists with this email"
            });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await userModel.create({ email, name, password: hashedPassword });


        const accessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken();
        const hashToken = await hashToken(refreshToken);

        await refreshTokenModel.create({
            userId: user._id,
            token: hashToken,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        });

        emailService.sendRegistrationEmail(user.email, user.name)
            .catch(err => console.error('Error sending registration email:', err));

        return res.status(201).json({
            statusCode: 201,
            status: 'success',
            message: "User registered successfully",
            user: {
                _id: user._id,
                email: user.email,
                name: user.name
            },
            accessToken: accessToken,
            refreshToken: refreshToken
        });

    } catch (error) {
        console.error('Register error:', error);
        return res.status(500).json({
            statusCode: 500,
            status: 'failed',
            message: "Internal server error"
        });
    }
}
async function userLoginController(req, res) {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                statusCode: 400,
                status: 'failed',
                message: "All fields are required"
            });
        }

        const user = await userModel.findOne({ email }).select('+password');
        if (!user) {
            return res.status(401).json({

                statusCode: 401,
                status: 'failed',
                message: "Invalid Credentials"
            });
        }

        const isValidPassword = await user.comparePassword(password);
        if (!isValidPassword) {
            return res.status(401).json({
                statusCode: 401,
                status: 'failed',
                message: "Invalid Credentials"
            });
        }

        const accessToken = jwt.sign(
            { userId: user._id },
            process.env.JWT_ACCESS_SECRET,
            { expiresIn: "15m" }
        );

        const refreshToken = jwt.sign(
            { userId: user._id },
            process.env.JWT_ACCESS_SECRET,
            { expiresIn: "7d" }
        );


        return res.status(200).json({
            statusCode: 200,
            status: 'success',
            message: "User Logged in successfully",
            user: {
                _id: user._id,
                email: user.email,
                name: user.name
            },
            accessToken: token
        });

    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({
            statusCode: 500,
            status: 'failed',
            message: "Internal server error"
        });
    }
}
async function userLogoutController(req, res) {
    try {
        console.log("Before logout:", req.cookies.token);
        const token =
            req.cookies.token ||
            req.headers.authorization?.split(' ')[1];

        if (!token) {
            return res.status(400).json({
                statusCode: 400,
                status: 'failed',
                message: "User already logged out",
            });
        }

        res.clearCookie("accesstoken", {
            httpOnly: true,
            secure: false,
            sameSite: "Lax",
        });

        await tokenBlackList.create({ token });
        console.log("After logout:", req.cookies.token);

        return res.status(200).json({
            statusCode: 200,
            status: 'success',
            message: "User logged out Successfully",
        });

    } catch (error) {
        console.error('Logout error:', error);
        return res.status(500).json({
            statusCode: 500,
            status: 'failed',
            message: "Internal server error",
        });
    }
}

export default { userRegisterController, userLoginController, userLogoutController };