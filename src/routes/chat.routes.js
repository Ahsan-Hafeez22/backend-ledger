import express from 'express';
import authMiddleware from '../middlewares/auth.middleware.js';
import { apiLimiter } from '../middlewares/rateLimiter.js';
import * as chatController from '../controllers/chat.controller.js';

const router = express.Router();

// GET /api/chat/messages?senderId=<id>&receiverId=<id>&page=1&limit=20
router.get(
    '/messages',
    apiLimiter,
    authMiddleware.authMiddleware,
    chatController.getMessages,
);

// GET /api/chat/rooms
router.get(
    '/rooms',
    apiLimiter,
    authMiddleware.authMiddleware,
    chatController.getChatRoomMessages,
);

export default router;

