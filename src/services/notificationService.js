import { getMessaging } from "../config/firebase.config.js";
import userModel from "../models/user.model.js";
import logger from "logger";

const PERMANENT_FAILURE_CODES = new Set([
    'messaging/invalid-registration-token',
    'messaging/registration-token-not-registered',
    'messaging/invalid-argument',
]);

const TEMPORARY_FAILURE_CODES = new Set([
    'messaging/internal-error',
    'messaging/server-unavailable',
    'messaging/quota-exceeded',
]);

class NotificationService {
    static #buildMessage(tokens, { title, body, imageUrl, data = {} }) {
        return {
            tokens,
            notification: {
                title,
                body,
                ...(imageUrl && { imageUrl }),
            },
            data: {
                ...Object.fromEntries(
                    Object.entries(data).map(([k, v]) => [k.toString(), v.toString()]) // ✅ fixed typo
                )
            },
            android: {
                priority: 'high',
                notification: {
                    sound: 'default',
                    clickAction: 'FLUTTER_NOTIFICATION_CLICK',
                    ...(imageUrl && { imageUrl }),
                }
            },
            apns: {
                headers: { 'apns-priority': '10' },
                payload: { aps: { sound: 'default', badge: 1 } },
            }
        };
    }

    static async sendToTokens(tokens, payload) {
        if (!tokens?.length) return { successCount: 0, failureCount: 0, invalidTokens: [], tempFailedTokens: [] };

        const BATCH_SIZE = 500;
        let successCount = 0;
        let failureCount = 0;
        const invalidTokens = [];
        const tempFailedTokens = [];

        for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
            const batch = tokens.slice(i, i + BATCH_SIZE);
            const message = this.#buildMessage(batch, payload);

            try {
                const response = await getMessaging().sendEachForMulticast(message);

                successCount += response.successCount;
                failureCount += response.failureCount;

                response.responses.forEach((res, idx) => {
                    if (res.success) return;

                    const code = res.error?.code;
                    const token = batch[idx];

                    logger.warn(`[FCM] Delivery failed — code: ${code}, token: ${token.slice(0, 20)}...`);

                    if (PERMANENT_FAILURE_CODES.has(code)) {
                        invalidTokens.push(token);
                    } else if (TEMPORARY_FAILURE_CODES.has(code)) {
                        tempFailedTokens.push(token);
                    }
                });

            } catch (err) {
                logger.error('[FCM] Batch send error:', err);
                failureCount += batch.length;
            }
        }

        logger.info(`[FCM] Result — success: ${successCount}, failure: ${failureCount}, invalid: ${invalidTokens.length}, temp-failed: ${tempFailedTokens.length}`);
        return { successCount, failureCount, invalidTokens, tempFailedTokens };
    }

    static async sendToUser(userId, payload, notifType = '') {
        const user = await userModel.findById(userId).select('fcmTokens notificationPrefs');

        if (!user) {
            logger.warn(`[FCM] User ${userId} not found`);
            return;
        }
        if (notifType.includes('MARKETING') && !user.notificationPrefs.marketing) {
            logger.info(`[FCM] Skipped — user ${userId} has marketing notifications disabled`);
            return;
        }
        if (notifType.includes('ACCOUNT') && !user.notificationPrefs.security) {
            logger.info(`[FCM] Skipped — user ${userId} has security notifications disabled`);
            return;
        }

        const activeTokens = user.fcmTokens
            .filter((t) => t.isActive && t.notificationsEnabled)
            .map((t) => t.token);

        if (!activeTokens.length) {
            logger.info(`[FCM] No active tokens for user ${userId}`);
            return;
        }

        const result = await this.sendToTokens(activeTokens, payload);

        if (result.invalidTokens.length > 0) {
            await this.#deactivateTokens(userId, result.invalidTokens, 'FCM_INVALID');
        }

        if (result.successCount > 0) {
            const successfulTokens = activeTokens.filter(
                (t) => !result.invalidTokens.includes(t) && !result.tempFailedTokens.includes(t)
            );
            await this.#updateLastUsed(userId, successfulTokens);
        }

        return result;
    }

    static async sendToUsers(userIds, payload) {
        const users = await userModel.find(
            { _id: { $in: userIds } },
            { fcmTokens: 1, notificationPrefs: 1 }
        );

        const allTokens = [];
        const tokenToUserMap = new Map();

        users.forEach((user) => {
            user.fcmTokens
                .filter((t) => t.isActive && t.notificationsEnabled)
                .forEach(({ token }) => {
                    allTokens.push(token);
                    tokenToUserMap.set(token, user._id);
                });
        });

        if (!allTokens.length) return;

        const result = await this.sendToTokens(allTokens, payload);

        if (result.invalidTokens.length > 0) {
            const invalidByUser = new Map();

            result.invalidTokens.forEach((token) => {
                const uid = tokenToUserMap.get(token)?.toString();
                if (!uid) return;
                if (!invalidByUser.has(uid)) invalidByUser.set(uid, []);
                invalidByUser.get(uid).push(token);
            });

            await Promise.all(
                [...invalidByUser.entries()].map(([uid, tokens]) =>
                    this.#deactivateTokens(uid, tokens, 'FCM_INVALID')
                )
            );
        }

        return result;
    }

    static async subscribeToTopic(userId, topic) {
        const user = await userModel.findById(userId).select('fcmTokens');
        if (!user?.fcmTokens.length) return;

        const tokens = user.fcmTokens.filter((t) => t.isActive).map((t) => t.token);

        try {
            const res = await getMessaging().subscribeToTopic(tokens, topic);
            logger.info(`[FCM] Subscribed user ${userId} to topic "${topic}" — success: ${res.successCount}`);
        } catch (err) {
            logger.error('[FCM] Topic subscribe error:', err);
        }
    }

    static async sendToTopic(topic, payload) {
        const { title, body, imageUrl, data = {} } = payload;

        const message = {
            topic,
            notification: { title, body, ...(imageUrl && { imageUrl }) },
            data: {
                ...Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
                sentAt: new Date().toISOString(),
            },
        };

        try {
            const messageId = await getMessaging().send(message);
            logger.info(`[FCM] Topic "${topic}" — messageId: ${messageId}`);
            return messageId;
        } catch (err) {
            logger.error(`[FCM] Topic "${topic}" send error:`, err);
            throw err;
        }
    }

    static async #deactivateTokens(userId, tokens, reason = 'FCM_INVALID') {
        try {
            await userModel.updateOne(
                { _id: userId },
                {
                    $set: {
                        'fcmTokens.$[elem].isActive': false,
                        'fcmTokens.$[elem].invalidAt': new Date(),
                    },
                },
                {
                    arrayFilters: [{ 'elem.token': { $in: tokens } }],
                    multi: true,
                }
            );
            logger.info(`[FCM] Deactivated ${tokens.length} invalid token(s) for user ${userId} — reason: ${reason}`);
        } catch (err) {
            logger.error('[FCM] Deactivate tokens error:', err);
        }
    }

    static async #updateLastUsed(userId, tokens) {
        try {
            await userModel.updateOne( // ✅ fixed: was `User`
                { _id: userId },
                { $set: { 'fcmTokens.$[elem].lastUsed': new Date() } },
                { arrayFilters: [{ 'elem.token': { $in: tokens } }], multi: true }
            );
        } catch (err) {
            logger.error('[FCM] updateLastUsed error:', err);
        }
    }
}

export default NotificationService;