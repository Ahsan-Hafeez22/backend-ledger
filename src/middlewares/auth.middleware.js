const jwt = require('jsonwebtoken');
const userModel = require('../models/user.model');

const authorizeUser = async (req, res, next) => {
    try {
        const token =
            req.cookies.token ||
            req.headers.authorization?.split(' ')[1];

        if (!token) {
            return res.status(401).json({ message: 'Unauthorized' });
        }
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await userModel.findById(decoded.userId);
        if (!user) {
            return res.status(401).json({ message: 'User not found' });
        }
        req.user = user;
        next();
    } catch (error) {
        console.log('Auth Middleware Error:', error.message);
        return res.status(401).json({
            message: 'Unauthorized access, token is invalid'
        });
    }
};

module.exports = authorizeUser;