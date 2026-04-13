// src/controllers/notificationController.js
import NotificationService from '../services/notificationService.js';
import { Payloads } from '../services/notificationPayloads.js';
import userModel from '../models/user.model.js';
import logger from '../utils/logger.js';

// Called internally from your transaction service — not an HTTP route
export const onMoneySent = async (transaction) => {
    try {
        await NotificationService.sendToUser(
            transaction.senderId,
            Payloads.moneySent({
                amount: transaction.amount, currency: transaction.currency,
                recipientName: transaction.recipientName, transactionId: transaction._id,
            })
        );

        await NotificationService.sendToUser(
            transaction.recipientId,
            Payloads.moneyReceived({
                amount: transaction.amount, currency: transaction.currency,
                senderName: transaction.senderName, transactionId: transaction._id,
            })
        );
    } catch (err) {
        logger.error('[Notification] onMoneySent error:', err);
        // Never throw — notification failure must NOT block transaction
    }
};

// POST /notifications/freeze-account  (admin only)
export const freezeAccount = async (req, res) => {
    const { userId, reason } = req.body;

    try {
        await userModel.findByIdAndUpdate(userId, { accountStatus: 'frozen' });
        await NotificationService.sendToUser(userId, Payloads.accountFrozen({ reason }));

        logger.info(`[Admin] Account ${userId} frozen`);
        res.json({ message: 'Account frozen and user notified' });
    } catch (err) {
        logger.error('[Notification] freezeAccount error:', err);
        res.status(500).json({ message: 'Server error' });
    }
};


// POST /notifications/broadcast  (admin only)
export const broadcastAlert = async (req, res) => {
    const { title, body, topic = 'all-users' } = req.body;

    try {
        await NotificationService.sendToTopic(topic, Payloads.systemAlert({ title, body }));
        res.json({ message: `Broadcast sent to topic: ${topic}` });
    } catch (err) {
        logger.error('[Notification] broadcast error:', err);
        res.status(500).json({ message: 'Server error' });
    }
};