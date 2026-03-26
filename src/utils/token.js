import crypto from 'crypto';
import jwt from 'jsonwebtoken';

const generateAccessToken = (user) => {
    return jwt.sign(
        { userId: user._id },
        process.env.JWT_ACCESS_SECRET,
        { expiresIn: "15m" }
    );
};

const generateRefreshToken = () => {
    return jwt.sign(
        {},
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: "7d" }
    );
};

const hashToken = (token) => {
    return crypto.createHash('sha256').update(token).digest('hex');
};

export { generateAccessToken, generateRefreshToken, hashToken };