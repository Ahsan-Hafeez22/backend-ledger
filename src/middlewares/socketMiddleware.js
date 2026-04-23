import jwt from 'jsonwebtoken';
import userModel from '../models/user.model.js';

export const socketAuthMiddleware = async (socket, next) => {
    try {
        // Flutter sends token like:
        // IO.io(url, OptionBuilder().setAuth({'token': jwtToken}).build())
        const token = socket.handshake.auth?.token;

        if (!token) {
            return next(new Error('AUTH_REQUIRED'));
        }


        const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
        const user = await userModel.findById(decoded.userId);
        if (!user) {
            return next(new Error('USER_NOT_FOUND'));
        }
        socket.user = user;

        next();

    } catch (err) {
        // jwt.verify throws if token is expired or invalid
        next(new Error('INVALID_TOKEN'));
    }
};