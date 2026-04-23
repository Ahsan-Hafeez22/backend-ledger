import mongoose from 'mongoose';
import { ObjectId } from 'mongodb';
import messageModel from '../models/message.model.js';
import { getRoomId } from '../utils/chatHelper.js';
import userModel from '../models/user.model.js';

// FIX 1: added missing `async` keyword
export const createMessage = async (messageData) => {
    try {
        const message = new messageModel({
            chatRoomId: messageData.chatRoomId,
            messageId: messageData.messageId,
            sender: messageData.sender,
            receiver: messageData.receiver,
            status: messageData.status,
            message: messageData.message,
            createdAt: messageData.createdAt
        });
        await message.save();
        return message;
    } catch (error) {
        throw error;
    }
}


export const fetchChatMessages = async (currentUserId, senderId, receiverId, page = 1, limit = 20) => {
    try {
        const roomId = getRoomId(senderId, receiverId);
        const query = { chatRoomId: roomId };

        // FIX 2: moved undeliveredQuery outside the inner try so it's in scope for updateMany
        const undeliveredQuery = {
            chatRoomId: roomId,
            sender: new mongoose.Types.ObjectId(senderId),
            receiver: new mongoose.Types.ObjectId(currentUserId),
            status: 'sent'
        };

        try {
            if (currentUserId === receiverId) {
                const undeliveredUpdate = await messageModel.updateMany(
                    undeliveredQuery,
                    { $set: { status: 'delivered' } }
                );
                if (undeliveredUpdate.modifiedCount > 0) {
                    console.log(`Updated ${undeliveredUpdate.modifiedCount} messages delivered`);
                }
            }

            // FIX 3: aggregate requires an array of pipeline stages
            const messages = await messageModel.aggregate([
                {
                    $match: query,
                },
                {
                    $sort: { createdAt: -1 },
                },
                {
                    $skip: (page - 1) * limit,
                },
                {
                    $limit: limit,
                },
                {
                    $addFields: {
                        isMine: {
                            $eq: ["$sender", { $toObjectId: currentUserId }]
                        }
                    },
                },
            ]);

            return messages.reverse();
        } catch (error) {
            throw new Error('Failed to fetch messages');
        }
    } catch (error) {
        throw error;
    }
}

export const updateMessageStatus = async (messageId, status) => {
    try {
        const updatedMessage = await messageModel.findOneAndUpdate(
            { messageId: messageId },
            { status: status },
            { returnDocument: 'after' }
        );
        return updatedMessage;
    } catch (error) {
        throw error;
    }
}

export const getUndeliveredMessages = async (userId, partnerId) => {
    try {
        // FIX 4: find() takes a single filter object, not three separate arguments
        const filter = {
            receiver: userId,
            status: 'sent',
            ...(partnerId ? { sender: partnerId } : {}),
        };
        const messages = await messageModel.find(filter).sort({ createdAt: 1 });

        return messages;
    } catch (error) {
        throw error;
    }
}


export const updateUserLastSeen = async (userId, lastSeen, isOnline) => {
    try {
        // FIX 5: first arg must be a filter object, not a bare value
        const update = { lastSeen };
        if (typeof isOnline === 'boolean') update.isOnline = isOnline;

        const user = await userModel.findOneAndUpdate(
            { _id: userId },
            update,
            { returnDocument: 'after' },
        );

        return user;
    } catch (error) {
        throw error;
    }
}


export const markMessageAsDelivered = async (userId, partnerId) => {
    try {
        const result = await messageModel.updateMany(
            { receiver: new ObjectId(userId), sender: new ObjectId(partnerId), status: 'sent' },
            {
                $set: {
                    status: 'delivered'
                }
            },
        );

        // FIX 6: modifiedCount (capital C)
        return result.modifiedCount;
    } catch (error) {
        throw error;
    }
}

export const markMessageAsRead = async (userId, partnerId) => {
    try {
        const result = await messageModel.updateMany(
            // FIX 7: status needs $in operator for array matching
            { receiver: new ObjectId(userId), sender: new ObjectId(partnerId), status: { $in: ['sent', 'delivered'] } },
            {
                $set: {
                    status: 'read'
                }
            },
        );

        // FIX 8: modifiedCount (capital C)
        return result.modifiedCount;
    } catch (error) {
        throw error;
    }
}

export const getUserLastSeen = async (userId) => {
    try {
        const user = await userModel.findById(userId).select('lastSeen');
        if (!user) {
            return null;
        }
        return user.lastSeen ? user.lastSeen.toISOString() : null;
    } catch (error) {
        throw error;
    }
}

// FIX 9: removed duplicate getUserLastSeen definition

export const getUserOnlineStatus = async (userId) => {
    try {
        const user = await userModel.findById(userId).select('lastSeen isOnline');
        if (!user) {
            return { isOnline: false, lastSeen: null };
        }
        // FIX 10: return was on its own line, causing the object to never be returned (returned undefined instead)
        // FIX 11: missing comma between isOnline and lastSeen properties
        return {
            isOnline: user.isOnline || false,
            lastSeen: user.lastSeen ? user.lastSeen.toISOString() : null
        };

    } catch (error) {
        throw error;
    }
}

export const chatRoom = async (userId) => {
    try {

        const userObjectId = new ObjectId(userId);


        const privateChatQuery = {
            $or: [
                { sender: userObjectId },
                { receiver: userObjectId },
            ]
        };

        const privateChats = await messageModel.aggregate([
            { $match: privateChatQuery },
            { $sort: { createdAt: -1 } },
            {
                $group: {

                    _id: {
                        $cond: [
                            { $ne: ["$sender", userObjectId] },
                            "$sender",
                            "$receiver"
                        ]
                    },
                    latestMessageTime: { "$first": "$createdAt" },

                    latestMessage: { "$first": "$message" },
                    sender: { "$first": "$sender" },
                    messages: {
                        $push: {
                            sender: "$sender",
                            receiver: "$receiver",
                            status: "$status"
                        }
                    }
                }
            },
            {
                $lookup: {
                    from: "users",
                    localField: "_id",
                    foreignField: "_id",
                    as: "userDetails"
                }
            },
            {
                $unwind: "$userDetails"
            },
            {
                $project: {
                    _id: 0,
                    chatType: "private",
                    username: "$userDetails.name",
                    userId: "$userDetails._id",
                    latestMessageTime: 1,
                    latestMessage: 1,
                    senderId: "$sender",
                    unreadCount: {
                        $size: {
                            $filter: {
                                input: "$messages",
                                as: "msg",

                                cond: {
                                    $and: [
                                        { $eq: ["$$msg.receiver", userObjectId] },
                                        { $in: ["$$msg.status", ["sent", "delivered"]] }
                                    ]
                                }
                            }
                        }
                    },
                    lastMessageStatus: {
                        $cond: [
                            { $eq: ["$sender", userObjectId] },
                            {
                                $arrayElemAt: [
                                    {
                                        $map: {
                                            input: {
                                                $filter: {
                                                    input: "$messages",
                                                    as: "msg",
                                                    cond: {
                                                        $eq: ["$$msg.sender", userObjectId]
                                                    }
                                                }
                                            },
                                            as: 'm',

                                            in: "$$m.status"
                                        }
                                    },
                                    0
                                ]
                            },
                            null
                        ]
                    }
                }
            }
        ]);

        return privateChats.sort((a, b) => {
            return new Date(b.latestMessageTime) - new Date(a.latestMessageTime);
        });
    } catch (error) {
        throw error;
    }
}