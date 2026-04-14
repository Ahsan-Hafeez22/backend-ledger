// src/controllers/notificationController.js
import NotificationService from '../services/notificationService.js';
import { Payloads } from '../services/notificationPayloads.js';
import userModel from '../models/user.model.js';
import logger from '../utils/logger.js';

// Called internally from your transaction service — not an HTTP route
export const onMoneySent = async ({
    senderUserId,
    recipientUserId,
    senderName,
    recipientName,
    amount,
    currency,
    transactionId,
}) => {
    try {
        await NotificationService.sendToUser(
            senderUserId,
            Payloads.moneySent({
                amount,
                currency,
                recipientName,
                transactionId,
            }),
            'TRANSACTIONAL_MONEY_SENT'
        );

        await NotificationService.sendToUser(
            recipientUserId,
            Payloads.moneyReceived({
                amount,
                currency,
                senderName,
                transactionId,
            }),
            'TRANSACTIONAL_MONEY_RECEIVED'
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