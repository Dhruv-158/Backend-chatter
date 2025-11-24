const { onlineUsers } = require('../config/redis');

/**
 * Check if a user is online
 */
const checkUserOnlineStatus = async (req, res) => {
    try {
        const { userId } = req.params;
        
        const isOnline = await onlineUsers.isOnline(userId);
        
        res.status(200).json({
            success: true,
            data: {
                userId,
                isOnline,
                checkedAt: new Date()
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to check online status',
            error: error.message
        });
    }
};

/**
 * Check multiple users' online status
 */
const checkMultipleUsersOnlineStatus = async (req, res) => {
    try {
        const { userIds } = req.body;
        
        if (!Array.isArray(userIds)) {
            return res.status(400).json({
                success: false,
                message: 'userIds must be an array'
            });
        }
        
        const statuses = await Promise.all(
            userIds.map(async (userId) => ({
                userId,
                isOnline: await onlineUsers.isOnline(userId)
            }))
        );
        
        res.status(200).json({
            success: true,
            data: {
                statuses,
                checkedAt: new Date()
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to check online statuses',
            error: error.message
        });
    }
};

/**
 * Get all online users (for current user's friends only)
 */
const getOnlineFriends = async (req, res) => {
    try {
        const User = require('../models/User');
        const userId = req.user._id;
        
        // Get current user's friends
        const user = await User.findById(userId).select('friends');
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }
        
        // Filter friends who are online
        const friendsList = user.friends.map(friendId => friendId.toString());
        const onlineFriends = [];
        
        for (const friendId of friendsList) {
            const isOnline = await onlineUsers.isOnline(friendId);
            if (isOnline) {
                onlineFriends.push(friendId);
            }
        }
        
        res.status(200).json({
            success: true,
            data: {
                onlineFriends,
                count: onlineFriends.length,
                totalFriends: user.friends.length
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to get online friends',
            error: error.message
        });
    }
};

/**
 * Get all online users count (admin/stats)
 */
const getOnlineUsersCount = async (req, res) => {
    try {
        const count = await onlineUsers.count();
        
        res.status(200).json({
            success: true,
            data: {
                count,
                timestamp: new Date()
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to get online users count',
            error: error.message
        });
    }
};

module.exports = {
    checkUserOnlineStatus,
    checkMultipleUsersOnlineStatus,
    getOnlineFriends,
    getOnlineUsersCount
};
