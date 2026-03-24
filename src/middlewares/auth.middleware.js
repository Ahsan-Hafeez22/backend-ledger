const jwt = require('jsonwebtoken');
const userModel = require('../models/user.model');
const tokenBlacklistModel = require('../models/blacklist.model');
const authMiddleware = async (req, res, next) => {
    try {
        const token =
            req.cookies.token ||
            req.headers.authorization?.split(' ')[1];

        if (!token) {
            return res.status(401).json({ message: 'Unauthorized' });
        }
        const blacklistedToken = await tokenBlacklistModel.findOne({ token });
        if (blacklistedToken) {
            return res.status(401).json({ message: 'Unauthorized, token is blacklisted' });
        }
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await userModel.findById(decoded.userId);
        if (!user) {
            return res.status(401).json({ message: 'User not found' });
        }
        req.user = user;
        return next();
    } catch (error) {
        console.log('Auth Middleware Error:', error.message);
        return res.status(401).json({
            message: 'Unauthorized access, token is invalid'
        });
    }
};

const authSystemMiddleware = async (req, res, next) => {
    try {
        const token =
            req.cookies.token ||
            req.headers.authorization?.split(' ')[1];

        if (!token) {
            return res.status(401).json({ message: 'Unauthorized' });
        }
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await userModel.findById(decoded.userId).select('+systemUser');
        if (!user.systemUser) {
            return res.status(403).json({
                message: "Forbidden access, not a system user"
            })
        }

        req.user = user

        return next()
    } catch (error) {
        console.log('Auth Middleware Error:', error.message);
        return res.status(401).json({
            message: 'Unauthorized access, token is invalid'
        });
    }
};
module.exports = { authMiddleware, authSystemMiddleware };