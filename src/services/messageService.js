const Message = require('../models/Message');
const User = require('../models/User');
const { AppError } = require('../utils/errorHandler');
const { messageCache } = require('../config/redis');
const {
    generateImageThumbnail,
    compressImage,
    generateVideoThumbnail,
    getVideoDuration,
    getAudioDuration,
    extractLinkMetadata,
    deleteFile,
    getFileSize
} = require('../utils/fileProcessor');

/**
 * Check if users are friends
 */
const checkFriendship = async (userId1, userId2) => {
    const user = await User.findById(userId1);
    if (!user) {
        throw new AppError('User not found', 404);
    }
    if (!user.friends.includes(userId2)) {
        throw new AppError('You can only send messages to your friends', 403);
    }
    return true;
};

/**
 * Send text message
 */
const sendTextMessage = async (senderId, receiverId, content) => {
    try {
        await checkFriendship(senderId, receiverId);

        const conversationId = Message.generateConversationId(senderId, receiverId);

        const message = await Message.create({
            conversationId,
            sender: senderId,
            receiver: receiverId,
            messageType: 'text',
            content: content.trim()
        });

        await message.populate('sender', 'username profilePicture');
        await message.populate('receiver', 'username profilePicture');

        // ✅ Cache the message for 1 hour
        await messageCache.set(message._id.toString(), message.toObject(), 3600);

        return message;
    } catch (error) {
        throw error;
    }
};

/**
 * Send image message
 */
const sendImageMessage = async (senderId, receiverId, file) => {
    try {
        await checkFriendship(senderId, receiverId);

        // Compress image (skipped if Cloudinary)
        await compressImage(file.path);

        // Generate thumbnail
        const thumbnailUrl = await generateImageThumbnail(file.path);

        const conversationId = Message.generateConversationId(senderId, receiverId);
        const fileSize = await getFileSize(file.path);

        // Determine file URL (Cloudinary or local)
        const fileUrl = file.path.includes('cloudinary.com') ? file.path : `/uploads/images/${file.filename}`;

        const message = await Message.create({
            conversationId,
            sender: senderId,
            receiver: receiverId,
            messageType: 'image',
            fileUrl: fileUrl,
            fileName: file.originalname,
            fileSize: fileSize || file.size, // Fallback to multer size
            mimeType: file.mimetype,
            thumbnailUrl: thumbnailUrl
        });

        await message.populate('sender', 'username profilePicture');
        await message.populate('receiver', 'username profilePicture');

        // ✅ Cache the message for 1 hour
        await messageCache.set(message._id.toString(), message.toObject(), 3600);

        return message;
    } catch (error) {
        // Delete uploaded file if message creation fails
        if (file) {
            await deleteFile(file.path.includes('cloudinary.com') ? file.path : `/uploads/images/${file.filename}`);
        }
        throw error;
    }
};

/**
 * Send video message
 */
const sendVideoMessage = async (senderId, receiverId, file) => {
    try {
        await checkFriendship(senderId, receiverId);

        // Generate thumbnail and get duration
        const [thumbnailUrl, duration] = await Promise.all([
            generateVideoThumbnail(file.path),
            getVideoDuration(file.path)
        ]);

        const conversationId = Message.generateConversationId(senderId, receiverId);
        const fileSize = await getFileSize(file.path);

        // Determine file URL (Cloudinary or local)
        const fileUrl = file.path.includes('cloudinary.com') ? file.path : `/uploads/videos/${file.filename}`;

        const message = await Message.create({
            conversationId,
            sender: senderId,
            receiver: receiverId,
            messageType: 'video',
            fileUrl: fileUrl,
            fileName: file.originalname,
            fileSize: fileSize || file.size,
            mimeType: file.mimetype,
            thumbnailUrl: thumbnailUrl,
            duration: duration
        });

        await message.populate('sender', 'username profilePicture');
        await message.populate('receiver', 'username profilePicture');

        // ✅ Cache the message for 1 hour
        await messageCache.set(message._id.toString(), message.toObject(), 3600);

        return message;
    } catch (error) {
        // Delete uploaded file if message creation fails
        if (file) {
            await deleteFile(file.path.includes('cloudinary.com') ? file.path : `/uploads/videos/${file.filename}`);
        }
        throw error;
    }
};

/**
 * Send document message
 */
const sendDocumentMessage = async (senderId, receiverId, file) => {
    try {
        await checkFriendship(senderId, receiverId);

        const conversationId = Message.generateConversationId(senderId, receiverId);
        const fileSize = await getFileSize(file.path);

        // Determine file URL (Cloudinary or local)
        const fileUrl = file.path.includes('cloudinary.com') ? file.path : `/uploads/documents/${file.filename}`;

        const message = await Message.create({
            conversationId,
            sender: senderId,
            receiver: receiverId,
            messageType: 'document',
            fileUrl: fileUrl,
            fileName: file.originalname,
            fileSize: fileSize || file.size,
            mimeType: file.mimetype
        });

        await message.populate('sender', 'username profilePicture');
        await message.populate('receiver', 'username profilePicture');

        // ✅ Cache the message for 1 hour
        await messageCache.set(message._id.toString(), message.toObject(), 3600);

        return message;
    } catch (error) {
        // Delete uploaded file if message creation fails
        if (file) {
            await deleteFile(file.path.includes('cloudinary.com') ? file.path : `/uploads/documents/${file.filename}`);
        }
        throw error;
    }
};

/**
 * Send audio message
 */
const sendAudioMessage = async (senderId, receiverId, file) => {
    try {
        await checkFriendship(senderId, receiverId);

        // Get audio duration
        const duration = await getAudioDuration(file.path);

        const conversationId = Message.generateConversationId(senderId, receiverId);
        const fileSize = await getFileSize(file.path);

        // Determine file URL (Cloudinary or local)
        const fileUrl = file.path.includes('cloudinary.com') ? file.path : `/uploads/audio/${file.filename}`;

        const message = await Message.create({
            conversationId,
            sender: senderId,
            receiver: receiverId,
            messageType: 'audio',
            fileUrl: fileUrl,
            fileName: file.originalname,
            fileSize: fileSize || file.size,
            mimeType: file.mimetype,
            duration: duration
        });

        await message.populate('sender', 'username profilePicture');
        await message.populate('receiver', 'username profilePicture');

        // ✅ Cache the message for 1 hour
        await messageCache.set(message._id.toString(), message.toObject(), 3600);

        return message;
    } catch (error) {
        // Delete uploaded file if message creation fails
        if (file) {
            await deleteFile(file.path.includes('cloudinary.com') ? file.path : `/uploads/audio/${file.filename}`);
        }
        throw error;
    }
};

/**
 * Send link message with preview
 */
const sendLinkMessage = async (senderId, receiverId, url, content = '') => {
    try {
        await checkFriendship(senderId, receiverId);

        // Extract link metadata
        const linkMetadata = await extractLinkMetadata(url);

        if (!linkMetadata) {
            throw new AppError('Invalid URL or unable to fetch link preview', 400);
        }

        const conversationId = Message.generateConversationId(senderId, receiverId);

        const message = await Message.create({
            conversationId,
            sender: senderId,
            receiver: receiverId,
            messageType: 'link',
            content: content.trim(),
            linkMetadata: linkMetadata
        });

        await message.populate('sender', 'username profilePicture');
        await message.populate('receiver', 'username profilePicture');

        // ✅ Cache the message for 1 hour
        await messageCache.set(message._id.toString(), message.toObject(), 3600);

        return message;
    } catch (error) {
        throw error;
    }
};

/**
 * Get conversation messages with pagination
 */
const getConversationMessages = async (userId, friendId, page = 1, limit = 50) => {
    try {
        await checkFriendship(userId, friendId);

        const conversationId = Message.generateConversationId(userId, friendId);
        const skip = (page - 1) * limit;

        const messages = await Message.find({
            conversationId,
            isDeleted: false
        })
            .populate('sender', 'username profilePicture')
            .populate('receiver', 'username profilePicture')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const total = await Message.countDocuments({
            conversationId,
            isDeleted: false
        });

        return {
            messages: messages.reverse(), // Reverse to show oldest first
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(total / limit),
                totalItems: total,
                itemsPerPage: limit
            }
        };
    } catch (error) {
        throw error;
    }
};

/**
 * Mark message as read
 */
const markMessageAsRead = async (messageId, userId) => {
    try {
        const message = await Message.findById(messageId);

        if (!message) {
            throw new AppError('Message not found', 404);
        }

        // Only receiver can mark as read
        if (message.receiver.toString() !== userId) {
            throw new AppError('You can only mark messages sent to you as read', 403);
        }

        if (!message.isRead) {
            await message.markAsRead();
        }

        return message;
    } catch (error) {
        throw error;
    }
};

/**
 * Mark all messages in conversation as read
 */
const markConversationAsRead = async (userId, friendId) => {
    try {
        const conversationId = Message.generateConversationId(userId, friendId);

        await Message.updateMany(
            {
                conversationId,
                receiver: userId,
                isRead: false
            },
            {
                isRead: true,
                readAt: new Date()
            }
        );

        return { message: 'All messages marked as read' };
    } catch (error) {
        throw error;
    }
};

/**
 * Get unread message count
 */
const getUnreadCount = async (userId) => {
    try {
        const count = await Message.countDocuments({
            receiver: userId,
            isRead: false,
            isDeleted: false
        });

        return count;
    } catch (error) {
        throw error;
    }
};

/**
 * Delete message
 */
const deleteMessage = async (messageId, userId) => {
    try {
        const message = await Message.findById(messageId);

        if (!message) {
            throw new AppError('Message not found', 404);
        }

        // Only sender can delete
        if (message.sender.toString() !== userId) {
            throw new AppError('You can only delete messages you sent', 403);
        }

        // Soft delete
        await message.softDelete();

        // ✅ Delete from cache
        await messageCache.delete(message._id.toString());

        // Delete associated files if any
        if (message.fileUrl) {
            await deleteFile(message.fileUrl);
        }
        if (message.thumbnailUrl) {
            await deleteFile(message.thumbnailUrl);
        }

        return { message: 'Message deleted successfully' };
    } catch (error) {
        throw error;
    }
};

/**
 * Get all conversations for a user
 * ✅ Returns format matching frontend expectations:
 * {
 *   _id: conversationId,
 *   friend: { _id, username, profilePicture },
 *   lastMessage: { _id, content, messageType, createdAt },
 *   lastMessageTime: Date,
 *   unreadCount: Number
 * }
 */
const getUserConversations = async (userId) => {
    try {
        // Convert string userId to ObjectId
        const mongoose = require('mongoose');
        const userObjectId = new mongoose.Types.ObjectId(userId);

        const conversations = await Message.aggregate([
            {
                $match: {
                    $or: [{ sender: userObjectId }, { receiver: userObjectId }],
                    isDeleted: false
                }
            },
            {
                $sort: { createdAt: -1 }
            },
            {
                $group: {
                    _id: '$conversationId',
                    lastMessage: { $first: '$$ROOT' },
                    unreadCount: {
                        $sum: {
                            $cond: [
                                { 
                                    $and: [
                                        { $eq: ['$receiver', userObjectId] }, 
                                        { $eq: ['$isRead', false] }
                                    ] 
                                },
                                1,
                                0
                            ]
                        }
                    }
                }
            },
            {
                $sort: { 'lastMessage.createdAt': -1 }
            }
        ]);
        // Populate user details
        await Message.populate(conversations, {
            path: 'lastMessage.sender lastMessage.receiver',
            select: 'username profilePicture'
        });

        // ✅ Transform to frontend-expected format
        const formattedConversations = conversations
            .filter(conv => {
                // Skip if lastMessage or user data is missing
                const lastMsg = conv.lastMessage;
                if (!lastMsg || !lastMsg.sender || !lastMsg.receiver) {
                    return false;
                }
                return true;
            })
            .map(conv => {
                const lastMsg = conv.lastMessage;
                
                // Determine who is the friend (the other person in conversation)
                const friend = lastMsg.sender._id.toString() === userId.toString() 
                    ? lastMsg.receiver 
                    : lastMsg.sender;

                return {
                    _id: conv._id,
                    friend: {
                        _id: friend._id,
                        username: friend.username,
                        profilePicture: friend.profilePicture || '/uploads/profiles/default.png'
                    },
                    lastMessage: {
                        _id: lastMsg._id,
                        content: lastMsg.content || `[${lastMsg.messageType}]`,
                        messageType: lastMsg.messageType,
                        createdAt: lastMsg.createdAt
                    },
                    lastMessageTime: lastMsg.createdAt,
                    unreadCount: conv.unreadCount
                };
            });

        return formattedConversations;
    } catch (error) {
        throw error;
    }
};

module.exports = {
    sendTextMessage,
    sendImageMessage,
    sendVideoMessage,
    sendDocumentMessage,
    sendAudioMessage,
    sendLinkMessage,
    getConversationMessages,
    markMessageAsRead,
    markConversationAsRead,
    getUnreadCount,
    deleteMessage,
    getUserConversations
};
