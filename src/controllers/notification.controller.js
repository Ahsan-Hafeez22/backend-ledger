// src/controllers/notificationController.js
import NotificationService from '../services/notificationService.js';
import { Payloads } from '../services/notificationPayloads.js';
import userModel from '../models/user.model.js';
import notificationModel from '../models/notification.model.js';
import logger from '../utils/logger.js';
import mongoose from 'mongoose';

// ─── Internal helpers ────────────────────────────────────────────────────────

/**
 * Persist + push a notification in one call.
 * @param {string} userId
 * @param {string} type        - e.g. 'MONEY_SENT'
 * @param {object} payload     - { title, body, data }
 * @param {string} [template]  - NotificationService template key
 */
const notify = async (userId, type, payload, template) => {
    await notificationModel.create({ user: userId, type, ...payload });
    if (template) {
        await NotificationService.sendToUser(userId, payload, template);
    }
};

// ─── Internal event handlers (not HTTP routes) ────────────────────────────────

export const onMoneySent = async ({
    senderUserId, recipientUserId,
    senderName, recipientName,
    amount, currency, transactionId,
}) => {
    try {
        await Promise.all([
            notify(senderUserId, 'MONEY_SENT', Payloads.moneySent({ amount, currency, recipientName, transactionId }), 'TRANSACTIONAL_MONEY_SENT'),
            notify(recipientUserId, 'MONEY_RECEIVED', Payloads.moneyReceived({ amount, currency, senderName, transactionId }), 'TRANSACTIONAL_MONEY_RECEIVED'),
        ]);
    } catch (err) {
        logger.error('[Notification] onMoneySent error:', err);
        // Never throw — notification failure must NOT block the transaction
    }
};

export const onAccountCreation = async ({ accountNumber, recipientUserId }) => {
    try {
        await notify(
            recipientUserId,
            'ACCOUNT_CREATED',
            Payloads.accountCreationSuccess({ accountNumber }),
            'ACCOUNT_CREATED_SUCCESSFULLY',
        );
    } catch (err) {
        logger.error('[Notification] onAccountCreation error:', err);
    }
};


export const onAccountFreeze = async ({ accountNumber, recipientUserId, reason }) => {
    try {
        await notify(
            recipientUserId,
            'ACCOUNT_FREEZE',
            Payloads.accountFrozen({ reason }),
            'ACCOUNT_FREEZED',
        );
    } catch (err) {
        logger.error('[Notification] onAccountFreezea error:', err);
    }
};

// ─── Admin HTTP routes ────────────────────────────────────────────────────────

// POST /notifications/freeze-account
export const freezeAccount = async (req, res) => {
    try {
        const { userId, reason } = req.body;

        if (!mongoose.isValidObjectId(userId)) {
            return res.status(400).json({ message: 'Invalid userId' });
        }

        await userModel.findByIdAndUpdate(userId, { accountStatus: 'frozen' });
        await notify(userId, 'ACCOUNT_FROZEN', Payloads.accountFrozen({ reason }));

        logger.info(`[Admin] Account ${userId} frozen by ${req.user._id}`);
        return res.json({ message: 'Account frozen and user notified' });
    } catch (err) {
        logger.error('[Notification] freezeAccount error:', err);
        return res.status(500).json({ message: 'Server error' });
    }
};

// POST /notifications/broadcast
export const broadcastAlert = async (req, res) => {
    try {
        const { title, body, topic = 'all-users' } = req.body;

        if (!title || !body) {
            return res.status(400).json({ message: 'title and body are required' });
        }

        await NotificationService.sendToTopic(topic, Payloads.systemAlert({ title, body }));
        return res.json({ message: `Broadcast sent to topic: ${topic}` });
    } catch (err) {
        logger.error('[Notification] broadcast error:', err);
        return res.status(500).json({ message: 'Server error' });
    }
};

// ─── User HTTP routes ─────────────────────────────────────────────────────────

// GET /api/notifications?limit=20&cursor=<ISO string>
export const listMyNotifications = async (req, res) => {
    try {
        const limit = Math.min(Number(req.query.limit ?? 20) || 20, 50);
        const cursor = req.query.cursor ? new Date(String(req.query.cursor)) : null;

        const filter = { user: req.user._id };
        if (cursor && !Number.isNaN(cursor.getTime())) {
            filter.createdAt = { $lt: cursor };
        }

        const items = await notificationModel
            .find(filter)
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean();

        const nextCursor = items.length ? items[items.length - 1].createdAt : null;
        return res.status(200).json({ items, nextCursor });
    } catch (err) {
        logger.error('[Notification] listMyNotifications error:', err);
        return res.status(500).json({ message: 'Server error' });
    }
};

// GET /api/notifications?limit=20&cursor=<ISO string>
export const getUnreadCount = async (req, res) => {
    try {
        const count = await notificationModel.countDocuments({
            user: req.user._id,
            $or: [{ readAt: null }, { readAt: { $exists: false } }]
        }); return res.status(200).json({
            statusCode: 200,
            status: "success",
            message: "Unread Count",
            count: count
        });
    } catch (err) {
        logger.error('[Notification] listMyNotifications error:', err);
        return res.status(500).json({ message: 'Server error' });
    }
};


// Test Notification: — manual push test endpoint
// POST /api/notifications/test-token
export const testSendToToken = async (req, res) => {
    const { token, tokens, title, body, imageUrl, data } = req.body ?? {};

    const tokenList = Array.isArray(tokens)
        ? tokens.filter((t) => typeof t === 'string' && t.trim().length > 0)
        : (typeof token === 'string' && token.trim().length > 0 ? [token] : []);

    if (tokenList.length === 0) {
        return res.status(400).json({ message: 'Provide `token` (string) or `tokens` (string[])' });
    }
    if (!title || typeof title !== 'string') {
        return res.status(400).json({ message: 'title (string) is required' });
    }
    if (!body || typeof body !== 'string') {
        return res.status(400).json({ message: 'body (string) is required' });
    }

    try {
        const result = await NotificationService.sendToTokens(tokenList, {
            title,
            body,
            imageUrl,
            data,
        });
        await notify(req.user._id, 'Test notification', Payloads.testNotification());


        return res.status(200).json({ message: 'Notification attempted', result });
    } catch (err) {
        logger.error('[Notification] testSendToToken error:', err);
        return res.status(500).json({ message: 'Server error' });
    }
};


// PATCH /api/notifications/:id/read
export const markNotificationRead = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({ message: 'Invalid notification ID' });
        }

        const updated = await notificationModel.findOneAndUpdate(
            { _id: id, user: req.user._id, readAt: null },
            { $set: { readAt: new Date() } },
            { new: true },
        );

        if (!updated) {
            return res.status(404).json({ message: 'Notification not found' });
        }

        return res.status(200).json({ item: updated });
    } catch (err) {
        logger.error('[Notification] markNotificationRead error:', err);
        return res.status(500).json({ message: 'Server error' });
    }
};

// POST /api/notifications/mark-all-as-read
export const markAllNotificationsAsRead = async (req, res) => {
    try {
        await notificationModel.updateMany(
            { user: req.user._id, readAt: null },
            { $set: { readAt: new Date() } },
        );
        return res.status(200).json({ message: 'All notifications marked as read' });
    } catch (err) {
        logger.error('[Notification] markAllNotificationsAsRead error:', err);
        return res.status(500).json({ message: 'Server error' });
    }
};

// DELETE /api/notifications/:id
export const deleteNotification = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({ message: 'Invalid notification ID' });
        }

        const deleted = await notificationModel.findOneAndDelete({   // ✅ correct model
            _id: id,
            user: req.user._id,                                      // ✅ correct field
        });

        if (!deleted) {
            return res.status(404).json({ message: 'Notification not found' });
        }

        return res.status(200).json({ message: 'Notification deleted successfully' });
    } catch (err) {
        logger.error('[Notification] deleteNotification error:', err);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

// DELETE /api/notifications/delete-many
export const deleteManyNotification = async (req, res) => {
    try {
        const { ids } = req.body;

        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ message: 'No IDs provided' });
        }

        const validIds = ids.filter(id => mongoose.isValidObjectId(id));
        if (validIds.length === 0) {
            return res.status(400).json({ message: 'No valid IDs provided' });
        }

        await notificationModel.deleteMany({                         // ✅ correct model
            _id: { $in: validIds },
            user: req.user._id,                                      // ✅ correct field
        });

        return res.status(200).json({ message: 'Notifications deleted successfully' });
    } catch (err) {
        logger.error('[Notification] deleteManyNotification error:', err);
        return res.status(500).json({ message: 'Internal server error' });
    }
};