import { v4 as uuidv4 } from 'uuid'; // npm install uuid
import {
    createMessage,
    getUndeliveredMessages,
    markMessageAsDelivered,
    markMessageAsRead,
    updateUserLastSeen,
    getUserLastSeen,
    getUserOnlineStatus,
} from '../services/chatService.js';

import {
    addUser,
    removeUser,
    isUserOnline,
} from './socketManager.js';

import { getRoomId } from '../utils/chatHelper.js';

export const initSocketHandler = (io) => {

    io.on('connection', async (socket) => {
        // At this point socket.user is set by middleware
        const userId = socket.user._id.toString();
        const username = socket.user.name;

        console.log(`✅ ${username} connected — socket: ${socket.id}`);

        // ── Register this user as online ──
        addUser(userId, socket.id);

        // ── Join their personal room ──
        // Why? So we can emit to a user by userId without knowing their socketId.
        // io.to(userId).emit(...) works even after reconnects.
        socket.join(userId);

        // ── Update online status in DB ──
        // Why? So other users can see this person is now online via REST
        try {
            await updateUserLastSeen(userId, new Date(), true);
        } catch (err) {
            console.error('Failed to update lastSeen on connect:', err.message);
        }

        // ── Deliver any messages sent while this user was offline ──
        // Why? If someone messaged them while offline, status is still 'sent'.
        // Now they're online — mark as delivered and notify senders.
        try {
            const undeliveredMessages = await getUndeliveredMessages(userId);

            // Group by sender — one notification per sender, not per message
            const senderIds = [
                ...new Set(undeliveredMessages.map(m => m.sender.toString()))
            ];

            for (const senderId of senderIds) {
                // Mark all their messages to me as delivered
                await markMessageAsDelivered(userId, senderId);

                // Tell that sender "your messages just got delivered"
                if (isUserOnline(senderId)) {
                    io.to(senderId).emit('messages_delivered', {
                        byUserId: userId,
                        fromUserId: senderId,
                    });
                }
            }
        } catch (err) {
            console.error('Failed to deliver pending messages:', err.message);
        }

        // ── Notify all contacts that this user came online ──
        // In a real app you'd fetch the user's contact list.
        // For simplicity, broadcast to everyone. In production, filter to contacts only.
        socket.broadcast.emit('user_online', { userId, username });


        // ═══════════════════════════════════════════════════════
        // EVENT: send_message
        // Flutter emits this when user hits send
        // Payload: { receiverId, message }
        // ═══════════════════════════════════════════════════════
        socket.on('send_message', async ({ receiverId, message }) => {

            const chatRoomId = getRoomId(userId, receiverId);
            const messageId = uuidv4();
            const createdAt = new Date();

            const receiverOnline = isUserOnline(receiverId);

            // ✅ CORRECT: if receiver's app is connected = sent to their phone = 'delivered'
            // ❌ WRONG was: treating open_chat as the delivered trigger
            const initialStatus = receiverOnline ? 'delivered' : 'sent';

            await createMessage({
                chatRoomId,
                messageId,
                message: message.trim(),
                sender: userId,
                receiver: receiverId,
                status: initialStatus,
                createdAt,
            });

            const messagePayload = {
                messageId,
                chatRoomId,
                message: message.trim(),
                senderId: userId,
                receiverId,
                status: initialStatus,
                createdAt: createdAt.toISOString(),
            };

            if (receiverOnline) {
                io.to(receiverId).emit('chat_list_update', {
                    fromUserId: userId,
                    latestMessage: message.trim(),
                    latestMessageTime: createdAt.toISOString(),
                    unreadDelta: +1,          // Flutter increments its local count
                });
            }
            socket.emit('chat_list_update', {
                fromUserId: receiverId,       // the room is keyed by partner
                latestMessage: message.trim(),
                latestMessageTime: createdAt.toISOString(),
                lastMessageStatus: initialStatus,
                unreadDelta: 0,               // sender has no unread from themselves
            });
            // Confirm to Ali that message was saved (single tick)
            socket.emit('message_sent', messagePayload);
        });

        // ═══════════════════════════════════════════════════════
        // EVENT: open_chat
        // Flutter emits this when user opens a conversation screen
        // Payload: { partnerId }
        //
        // Why do we need this?
        // When you open a chat, all unread messages from that partner
        // should be marked as 'read'. We also need to tell the partner
        // "your messages were read" so they see the blue ticks.
        // ═══════════════════════════════════════════════════════
        socket.on('open_chat', async ({ partnerId }) => {

            // ✅ ONLY mark as read here — delivered already happened when message arrived
            const readCount = await markMessageAsRead(userId, partnerId);

            if (readCount > 0) {
                if (isUserOnline(partnerId)) {
                    io.to(partnerId).emit('messages_read', {
                        byUserId: userId,
                        fromUserId: partnerId,
                    });
                }
            }
            socket.emit('chat_list_update', {
                fromUserId: partnerId,
                unreadCount: 0,               // absolute reset, not a delta
            });
            // ✅ Still need this — for messages that arrived while Sara was offline
            // Those are still 'sent' in DB. Now she's online and opened the chat.
            // Skip straight to 'read' — no need to go sent → delivered → read
            const deliveredCount = await markMessageAsDelivered(userId, partnerId);
            if (deliveredCount > 0 && isUserOnline(partnerId)) {
                io.to(partnerId).emit('messages_delivered', {
                    byUserId: userId,
                    fromUserId: partnerId,
                });
            }
        });

        // ═══════════════════════════════════════════════════════
        // EVENT: typing
        // Flutter emits this while user is typing
        // Payload: { receiverId, isTyping: true/false }
        //
        // Why socket and not DB? Typing is ephemeral — no need to persist it.
        // ═══════════════════════════════════════════════════════
        socket.on('typing', ({ receiverId, isTyping }) => {
            if (!receiverId) return;

            if (isUserOnline(receiverId)) {
                io.to(receiverId).emit('partner_typing', {
                    senderId: userId,
                    isTyping,
                });
            }
        });


        // ═══════════════════════════════════════════════════════
        // EVENT: get_user_status
        // Flutter asks: "is this user online? when did they last seen?"
        // Payload: { targetUserId }
        // ═══════════════════════════════════════════════════════
        socket.on('get_user_status', async ({ targetUserId }) => {
            try {
                const online = isUserOnline(targetUserId);

                if (online) {
                    socket.emit('user_status', {
                        userId: targetUserId,
                        isOnline: true,
                        lastSeen: null,
                    });
                } else {
                    // Fetch lastSeen from DB
                    const lastSeen = await getUserLastSeen(targetUserId);
                    socket.emit('user_status', {
                        userId: targetUserId,
                        isOnline: false,
                        lastSeen,
                    });
                }
            } catch (err) {
                console.error('get_user_status error:', err);
            }
        });


        // ═══════════════════════════════════════════════════════
        // EVENT: disconnect
        // Fires automatically — when app closes, goes background,
        // loses internet, or explicitly disconnects
        // ═══════════════════════════════════════════════════════
        socket.on('disconnect', async (reason) => {
            console.log(`❌ ${username} disconnected — reason: ${reason}`);

            removeUser(userId, socket.id);

            // Save lastSeen timestamp to DB
            const lastSeen = new Date();
            try {
                await updateUserLastSeen(userId, lastSeen, false);
            } catch (err) {
                console.error('Failed to update lastSeen on disconnect:', err.message);
            }

            // Tell all contacts this user went offline
            socket.broadcast.emit('user_offline', {
                userId,
                lastSeen: lastSeen.toISOString(),
            });
        });

    });
};