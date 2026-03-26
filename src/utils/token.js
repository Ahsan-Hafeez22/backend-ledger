import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import refreshTokenModel from '../models/refresh.model.js';
const generateAccessToken = (user) => {
    return jwt.sign(
        { userId: user._id },
        process.env.JWT_ACCESS_SECRET,
        { expiresIn: "15m" }
    );
};

const generateRefreshToken = (user) => {
    return jwt.sign(
        { userId: user._id },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: "7d" }
    );
};

const findRefreshToken = async (token) => {
    try {
        console.log("Incoming token:", token);
        console.log("Incoming hash:", hashToken(token));
        const hashedToken = hashToken(token);
        return await refreshTokenModel.findOne({ token: hashedToken });
    } catch (error) {
        console.log(error);
    }
}
const hashToken = (token) => {
    return crypto.createHash('sha256').update(token).digest('hex');
};

export { generateAccessToken, generateRefreshToken, hashToken, findRefreshToken };