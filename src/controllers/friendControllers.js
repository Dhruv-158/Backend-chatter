const friendService = require('../services/friendService');
const logger = require('../utils/logger');

/**
 * Send friend request
 * @route POST /api/friends/request/:userId
 * @access Private
 */
const sendRequest = async (req, res) => {
    try {
        const senderId = req.user.id;
        const receiverId = req.params.userId;

        const friendRequest = await friendService.sendFriendRequest(senderId, receiverId);

        logger.info(`Friend request sent from ${senderId} to ${receiverId}`);

        return res.status(201).json({
            success: true,
            message: 'Friend request sent successfully',
            data: friendRequest
        });
    } catch (error) {
        logger.error(`Send friend request error: ${error.message}`);

        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to send friend request'
        });
    }
};

/**
 * Accept friend request
 * @route PUT /api/friends/accept/:requestId
 * @access Private
 */
const acceptRequest = async (req, res) => {
    try {
        const userId = req.user.id;
        const requestId = req.params.requestId;

        const friendRequest = await friendService.acceptFriendRequest(requestId, userId);

        logger.info(`Friend request ${requestId} accepted by ${userId}`);

        return res.status(200).json({
            success: true,
            message: 'Friend request accepted',
            data: friendRequest
        });
    } catch (error) {
        logger.error(`Accept friend request error: ${error.message}`);

        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to accept friend request'
        });
    }
};

/**
 * Reject friend request
 * @route PUT /api/friends/reject/:requestId
 * @access Private
 */
const rejectRequest = async (req, res) => {
    try {
        const userId = req.user.id;
        const requestId = req.params.requestId;

        const friendRequest = await friendService.rejectFriendRequest(requestId, userId);

        logger.info(`Friend request ${requestId} rejected by ${userId}`);

        return res.status(200).json({
            success: true,
            message: 'Friend request rejected',
            data: friendRequest
        });
    } catch (error) {
        logger.error(`Reject friend request error: ${error.message}`);

        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to reject friend request'
        });
    }
};

/**
 * Cancel friend request
 * @route DELETE /api/friends/cancel/:requestId
 * @access Private
 */
const cancelRequest = async (req, res) => {
    try {
        const userId = req.user.id;
        const requestId = req.params.requestId;

        const result = await friendService.cancelFriendRequest(requestId, userId);

        logger.info(`Friend request ${requestId} cancelled by ${userId}`);

        return res.status(200).json({
            success: true,
            message: result.message
        });
    } catch (error) {
        logger.error(`Cancel friend request error: ${error.message}`);

        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to cancel friend request'
        });
    }
};

/**
 * Get pending friend requests (received)
 * @route GET /api/friends/requests/pending
 * @access Private
 */
const getPendingRequests = async (req, res) => {
    try {
        const userId = req.user.id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;

        const result = await friendService.getPendingRequests(userId, page, limit);

        return res.status(200).json({
            success: true,
            count: result.requests.length,
            data: result.requests,
            pagination: result.pagination
        });
    } catch (error) {
        logger.error(`Get pending requests error: ${error.message}`);

        return res.status(500).json({
            success: false,
            message: 'Failed to fetch pending requests'
        });
    }
};

/**
 * Get sent friend requests
 * @route GET /api/friends/requests/sent
 * @access Private
 */
const getSentRequests = async (req, res) => {
    try {
        const userId = req.user.id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;

        const result = await friendService.getSentRequests(userId, page, limit);

        return res.status(200).json({
            success: true,
            count: result.requests.length,
            data: result.requests,
            pagination: result.pagination
        });
    } catch (error) {
        logger.error(`Get sent requests error: ${error.message}`);

        return res.status(500).json({
            success: false,
            message: 'Failed to fetch sent requests'
        });
    }
};

/**
 * Get friends list
 * @route GET /api/friends
 * @access Private
 */
const getFriends = async (req, res) => {
    try {
        const userId = req.user.id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;

        const result = await friendService.getFriendsList(userId, page, limit);

        return res.status(200).json({
            success: true,
            count: result.friends.length,
            data: result.friends,
            pagination: result.pagination
        });
    } catch (error) {
        logger.error(`Get friends list error: ${error.message}`);

        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to fetch friends list'
        });
    }
};

/**
 * Remove friend
 * @route DELETE /api/friends/remove/:userId
 * @access Private
 */
const removeFriend = async (req, res) => {
    try {
        const userId = req.user.id;
        const friendId = req.params.userId;

        const result = await friendService.removeFriend(userId, friendId);

        logger.info(`User ${userId} removed friend ${friendId}`);

        return res.status(200).json({
            success: true,
            message: result.message
        });
    } catch (error) {
        logger.error(`Remove friend error: ${error.message}`);

        return res.status(500).json({
            success: false,
            message: 'Failed to remove friend'
        });
    }
};

/**
 * Check friendship status
 * @route GET /api/friends/status/:userId
 * @access Private
 */
const checkStatus = async (req, res) => {
    try {
        const userId = req.user.id;
        const targetUserId = req.params.userId;

        const status = await friendService.checkFriendshipStatus(userId, targetUserId);

        return res.status(200).json({
            success: true,
            data: status
        });
    } catch (error) {
        logger.error(`Check friendship status error: ${error.message}`);

        return res.status(500).json({
            success: false,
            message: 'Failed to check friendship status'
        });
    }
};

module.exports = {
    sendRequest,
    acceptRequest,
    rejectRequest,
    cancelRequest,
    getPendingRequests,
    getSentRequests,
    getFriends,
    removeFriend,
    checkStatus
};
