const messageService = require('../services/messageService');
const logger = require('../utils/logger');
const { messageCache } = require('../config/redis');

/**
 * Send text message
 * @route POST /api/messages/text/:friendId
 * @access Private
 */
const sendTextMessage = async (req, res) => {
    try {
        const senderId = req.user.id;
        const receiverId = req.params.friendId;
        const { content } = req.body;

        if (!content || content.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Message content cannot be empty'
            });
        }

        const message = await messageService.sendTextMessage(senderId, receiverId, content);

        logger.info(`Text message sent from ${senderId} to ${receiverId}`);

        return res.status(201).json({
            success: true,
            message: message  // ✅ Return as 'message' for WebSocket compatibility
        });
    } catch (error) {
        logger.error(`Send text message error: ${error.message}`);

        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to send message'
        });
    }
};

/**
 * Send image message
 * @route POST /api/messages/image/:friendId
 * @access Private
 */
const sendImageMessage = async (req, res) => {
    try {
        const senderId = req.user.id;
        const receiverId = req.params.friendId;

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No image file uploaded'
            });
        }

        const message = await messageService.sendImageMessage(senderId, receiverId, req.file);

        logger.info(`Image message sent from ${senderId} to ${receiverId}`);

        return res.status(201).json({
            success: true,
            message: message  // ✅ Return as 'message' for WebSocket compatibility
        });
    } catch (error) {
        logger.error(`Send image message error: ${error.message}`);

        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to send image'
        });
    }
};

/**
 * Send video message
 * @route POST /api/messages/video/:friendId
 * @access Private
 */
const sendVideoMessage = async (req, res) => {
    try {
        const senderId = req.user.id;
        const receiverId = req.params.friendId;

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No video file uploaded'
            });
        }

        const message = await messageService.sendVideoMessage(senderId, receiverId, req.file);

        logger.info(`Video message sent from ${senderId} to ${receiverId}`);

        return res.status(201).json({
            success: true,
            message: message  // ✅ Return as 'message' for WebSocket compatibility
        });
    } catch (error) {
        logger.error(`Send video message error: ${error.message}`);

        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to send video'
        });
    }
};

/**
 * Send document message
 * @route POST /api/messages/document/:friendId
 * @access Private
 */
const sendDocumentMessage = async (req, res) => {
    try {
        const senderId = req.user.id;
        const receiverId = req.params.friendId;

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No document file uploaded'
            });
        }

        const message = await messageService.sendDocumentMessage(senderId, receiverId, req.file);

        logger.info(`Document message sent from ${senderId} to ${receiverId}`);

        return res.status(201).json({
            success: true,
            message: message  // ✅ Return as 'message' for WebSocket compatibility
        });
    } catch (error) {
        logger.error(`Send document message error: ${error.message}`);

        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to send document'
        });
    }
};

/**
 * Send audio message
 * @route POST /api/messages/audio/:friendId
 * @access Private
 */
const sendAudioMessage = async (req, res) => {
    try {
        const senderId = req.user.id;
        const receiverId = req.params.friendId;

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No audio file uploaded'
            });
        }

        const message = await messageService.sendAudioMessage(senderId, receiverId, req.file);

        logger.info(`Audio message sent from ${senderId} to ${receiverId}`);

        return res.status(201).json({
            success: true,
            message: message  // ✅ Return as 'message' for WebSocket compatibility
        });
    } catch (error) {
        logger.error(`Send audio message error: ${error.message}`);

        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to send audio'
        });
    }
};

/**
 * Send link message
 * @route POST /api/messages/link/:friendId
 * @access Private
 */
const sendLinkMessage = async (req, res) => {
    try {
        const senderId = req.user.id;
        const receiverId = req.params.friendId;
        const { url, content } = req.body;

        if (!url) {
            return res.status(400).json({
                success: false,
                message: 'URL is required'
            });
        }

        const message = await messageService.sendLinkMessage(senderId, receiverId, url, content || '');

        logger.info(`Link message sent from ${senderId} to ${receiverId}`);

        return res.status(201).json({
            success: true,
            message: message  // ✅ Return as 'message' for WebSocket compatibility
        });
    } catch (error) {
        logger.error(`Send link message error: ${error.message}`);

        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to send link'
        });
    }
};

/**
 * Get conversation messages (chat history with one friend)
 * @route GET /api/messages/conversation/:friendId
 * @access Private
 */
const getMessages = async (req, res) => {
    try {
        const userId = req.user.id;
        const friendId = req.params.friendId;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;

        const result = await messageService.getConversationMessages(userId, friendId, page, limit);

        return res.status(200).json({
            success: true,
            data: result.messages,
            pagination: result.pagination
        });
    } catch (error) {
        logger.error(`Get messages error: ${error.message}`);

        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to fetch messages'
        });
    }
};

/**
 * Mark message as read
 * @route PUT /api/messages/:messageId/read
 * @access Private
 */
const markAsRead = async (req, res) => {
    try {
        const userId = req.user.id;
        const messageId = req.params.messageId;

        const message = await messageService.markMessageAsRead(messageId, userId);

        // ✅ Update cache with read status
        await messageCache.set(messageId, message.toObject(), 3600);

        return res.status(200).json({
            success: true,
            message: 'Message marked as read',
            data: message
        });
    } catch (error) {
        logger.error(`Mark as read error: ${error.message}`);

        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to mark message as read'
        });
    }
};

/**
 * Mark all messages in conversation as read
 * @route PUT /api/messages/:friendId/read-all
 * @access Private
 */
const markConversationAsRead = async (req, res) => {
    try {
        const userId = req.user.id;
        const friendId = req.params.friendId;

        await messageService.markConversationAsRead(userId, friendId);

        return res.status(200).json({
            success: true,
            message: 'All messages marked as read'
        });
    } catch (error) {
        logger.error(`Mark conversation as read error: ${error.message}`);

        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to mark messages as read'
        });
    }
};

/**
 * Get unread message count
 * @route GET /api/messages/unread/count
 * @access Private
 */
const getUnreadCount = async (req, res) => {
    try {
        const userId = req.user.id;

        const count = await messageService.getUnreadCount(userId);

        return res.status(200).json({
            success: true,
            count: count
        });
    } catch (error) {
        logger.error(`Get unread count error: ${error.message}`);

        return res.status(500).json({
            success: false,
            message: 'Failed to get unread count'
        });
    }
};

/**
 * Delete message
 * @route DELETE /api/messages/:messageId
 * @access Private
 */
const deleteMessage = async (req, res) => {
    try {
        const userId = req.user.id;
        const messageId = req.params.messageId;

        await messageService.deleteMessage(messageId, userId);

        return res.status(200).json({
            success: true,
            message: 'Message deleted successfully'
        });
    } catch (error) {
        logger.error(`Delete message error: ${error.message}`);

        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to delete message'
        });
    }
};

/**
 * Get all conversations (chat list with last message and unread count per friend)
 * @route GET /api/messages/conversations
 * @access Private
 * @description Returns list of all friends you've chatted with, showing:
 *              - Last message from each conversation
 *              - Unread count per friend (for badges: John (2), Sarah (0), Mike (5))
 *              - Friend details (username, profile picture, online status)
 */
const getConversations = async (req, res) => {
    try {
        const userId = req.user.id;

        const conversations = await messageService.getUserConversations(userId);

        return res.status(200).json({
            success: true,
            count: conversations.length,
            data: conversations
        });
    } catch (error) {
        logger.error(`Get conversations error: ${error.message}`);

        return res.status(500).json({
            success: false,
            message: 'Failed to fetch conversations'
        });
    }
};

module.exports = {
    sendTextMessage,
    sendImageMessage,
    sendVideoMessage,
    sendDocumentMessage,
    sendAudioMessage,
    sendLinkMessage,
    getMessages,              // Get chat history with one friend
    markAsRead,
    markConversationAsRead,
    deleteMessage,
    getConversations         // Get chat list with unread badges per friend
    // ❌ REMOVED: getUnreadCount - Not useful, conversations API provides unread count per friend
};
