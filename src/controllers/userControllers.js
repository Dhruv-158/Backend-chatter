const userService = require('../services/userService');
const friendService = require('../services/friendService');
const { validationResult } = require('express-validator');
const logger = require('../utils/logger');

/**
 * Search users
 * @route GET /api/users/search?query=username
 * @access Private
 */
const searchUsers = async (req, res) => {
    try {
        const { query } = req.query;
        const currentUserId = req.user.id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;

        if (!query) {
            return res.status(400).json({
                success: false,
                message: 'Search query is required'
            });
        }

        const result = await userService.searchUsers(query, currentUserId, page, limit);

        // Add friendship status for each user
        const usersWithStatus = await Promise.all(
            result.users.map(async (user) => {
                const status = await friendService.checkFriendshipStatus(currentUserId, user._id.toString());
                return {
                    ...user.toObject(),
                    friendshipStatus: status.status,
                    requestId: status.requestId || null
                };
            })
        );

        return res.status(200).json({
            success: true,
            count: usersWithStatus.length,
            data: usersWithStatus,
            pagination: result.pagination
        });
    } catch (error) {
        logger.error(`Search users error: ${error.message}`);

        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Failed to search users'
        });
    }
};

/**
 * Get current user profile
 * @route GET /api/auth/profile
 * @access Private
 */
const getProfile = async (req, res) => {
    try {
        const user = req.userDetails;
        
        return res.status(200).json({
            success: true,
            data: {
                id: user._id,
                username: user.username,
                email: user.email,
                bio: user.bio,
                profilePicture: user.profilePicture,
                friendCount: user.friendCount, // ✅ NEW: Include friend count
                createdAt: user.createdAt,
                updatedAt: user.updatedAt
            }
        });
    } catch (error) {
        logger.error(`Get profile error: ${error.message}`);
        
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch profile'
        });
    }
};

/**
 * Update user profile
 * @route PUT /api/auth/profile
 * @access Private
 */
const updateProfile = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }
        const { bio } = req.body;
        const userId = req.user.id;
        const updatedUser = await userService.updateProfileService(userId, { bio });
        logger.info(`Profile updated: ${userId}`);
        return res.status(200).json({
            success: true,
            message: 'Profile updated successfully',
            data: {
                id: updatedUser._id,
                username: updatedUser.username,
                email: updatedUser.email,
                bio: updatedUser.bio,
                updatedAt: updatedUser.updatedAt
            }
        });
    } catch (error) {
        logger.error(`Update profile error: ${error.message}`);
        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Profile update failed'
        });
    }
};

const changeProfilePicture = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No file uploaded'
            });
        }
        const userId = req.user.id;
        const updatedUser = await userService.changeProfilePictureService(userId, req.file);
        logger.info(`Profile picture updated: ${userId}`);
        return res.status(200).json({
            success: true,
            message: 'Profile picture updated successfully',
            data: {
                id: updatedUser._id,
                profilePicture: updatedUser.profilePicture,
                updatedAt: updatedUser.updatedAt
            }
        });
    } catch (error) {
        logger.error(`Change profile picture error: ${error.message}`);
        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Profile picture update failed'
        });
    }
};


module.exports = {
    searchUsers,
    getProfile,
    updateProfile,
    changeProfilePicture
};