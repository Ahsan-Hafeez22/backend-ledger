// src/services/notificationPayloads.js

export const Payloads = {

    moneySent: ({ amount, currency = 'PKR', recipientName, transactionId }) => ({
        title: 'Money Sent ✅',
        body: `You sent ${currency} ${amount} to ${recipientName}`,
        data: { type: 'MONEY_SENT', transactionId: String(transactionId), amount: String(amount), currency, screen: 'TransactionDetailScreen' },
    }),

    moneyReceived: ({ amount, currency = 'PKR', senderName, transactionId }) => ({
        title: '💰 Money Received',
        body: `${senderName} sent you ${currency} ${amount}`,
        data: { type: 'MONEY_RECEIVED', transactionId: String(transactionId), amount: String(amount), currency, screen: 'TransactionDetailScreen' },
    }),

    accountFrozen: ({ reason = 'suspicious activity' }) => ({
        title: '🔒 Account Frozen',
        body: `Your account has been frozen due to ${reason}. Contact support.`,
        data: { type: 'ACCOUNT_FROZEN', reason, screen: 'SupportScreen' },
    }),

    accountSuspended: ({ untilDate }) => ({
        title: '⛔ Account Suspended',
        body: `Your account is suspended until ${untilDate}.`,
        data: { type: 'ACCOUNT_SUSPENDED', untilDate: String(untilDate), screen: 'AccountStatusScreen' },
    }),

    transactionSuccess: ({ transactionId, amount, currency = 'PKR' }) => ({
        title: 'Transaction Successful ✅',
        body: `Your transaction of ${currency} ${amount} was completed.`,
        data: { type: 'TRANSACTION_SUCCESS', transactionId: String(transactionId), screen: 'TransactionDetailScreen' },
    }),

    transactionFailed: ({ transactionId, reason = 'insufficient funds' }) => ({
        title: 'Transaction Failed ❌',
        body: `Your transaction failed: ${reason}. Please try again.`,
        data: { type: 'TRANSACTION_FAILED', transactionId: String(transactionId), reason, screen: 'TransactionDetailScreen' },
    }),

    newChatMessage: ({ senderName, preview, chatId }) => ({
        title: `New message from ${senderName}`,
        body: preview.length > 60 ? preview.slice(0, 57) + '...' : preview,
        data: { type: 'NEW_CHAT_MESSAGE', chatId: String(chatId), screen: 'ChatScreen' },
    }),

    bookingConfirmed: ({ bookingRef, serviceName, date }) => ({
        title: 'Booking Confirmed 🎉',
        body: `Your ${serviceName} booking (${bookingRef}) is confirmed for ${date}.`,
        data: { type: 'BOOKING_CONFIRMED', bookingRef: String(bookingRef), screen: 'BookingDetailScreen' },
    }),

    systemAlert: ({ title, body, data = {} }) => ({
        title,
        body,
        data: { type: 'SYSTEM_ALERT', ...data },
    }),
};