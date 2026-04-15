import express from 'express';
import authMiddleware from '../middlewares/auth.middleware.js';
import { apiLimiter } from '../middlewares/rateLimiter.js';
import * as notificationController from '../controllers/notification.controller.js';

const router = express.Router();

// List current user's notifications (for in-app notification screen)
router.get(
    '/get-notification',
    apiLimiter,
    authMiddleware.authMiddleware,
    notificationController.listMyNotifications
);

router.get(
    '/unread-notifications',
    apiLimiter,
    authMiddleware.authMiddleware,
    notificationController.getUnreadCount
);

// Mark one notification as read
router.patch(
    '/:id/read',
    apiLimiter,
    authMiddleware.authMiddleware,
    notificationController.markNotificationRead
);


// Mark All notification as read
router.patch(
    '/mark-all-as-read',
    apiLimiter,
    authMiddleware.authMiddleware,
    notificationController.markAllNotificationsAsRead
);
router.delete(
    '/delete-many-notification',
    apiLimiter,
    authMiddleware.authMiddleware,
    notificationController.deleteManyNotification
);

router.delete(
    '/:id',
    apiLimiter,
    authMiddleware.authMiddleware,
    notificationController.deleteNotification
);


router.post(
    '/test-token',
    apiLimiter,
    authMiddleware.authMiddleware,
    notificationController.testSendToToken
);

export default router;

