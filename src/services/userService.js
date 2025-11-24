require('dotenv').config();
const User = require('../models/User');
const { AppError } = require('../utils/errorHandler');
const fs = require('fs').promises;
const path = require('path');

/**
 * Search users by username or email
 */
const searchUsers = async (query, currentUserId, page = 1, limit = 20) => {
    try {
        if (!query || query.trim().length < 1) {
            throw new AppError('Search query must be at least 1 character', 400);
        }

        const skip = (page - 1) * limit;

        // Search from the start of username (^) for better results
        const searchRegex = new RegExp(`^${query}`, 'i'); // Case-insensitive, starts with query
        
        // Also search anywhere in username/email as fallback
        const containsRegex = new RegExp(query, 'i');

        const users = await User.find({
            _id: { $ne: currentUserId }, // Exclude current user
            $or: [
                { username: searchRegex },  // Starts with query (priority)
                { username: containsRegex }, // Contains query (fallback)
                { email: containsRegex }     // Contains in email
            ]
        })
            .select('username email profilePicture bio')
            .skip(skip)
            .limit(limit)
            .sort({ username: 1 }); // Sort alphabetically

        const total = await User.countDocuments({
            _id: { $ne: currentUserId },
            $or: [
                { username: searchRegex },
                { username: containsRegex },
                { email: containsRegex }
            ]
        });

        return {
            users,
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
 * Update user profile
 */
const updateProfileService = async (userId, updateData) => {
    try {
        const user = await User.findById(userId);
        if (!user) {
            throw new AppError('User not found', 404);
        }
        // Update allowed fields
        if (updateData.bio !== undefined) {
            user.bio = updateData.bio;
        }
        user.updatedAt = Date.now();
        await user.save();
        return user;
    } catch (error) {
        throw error;
    }
};

const changeProfilePictureService = async (userId, file) => {
    try {
        const user = await User.findById(userId);
        if (!user) {
            // Delete uploaded file if user not found
            if (file) {
                await fs.unlink(file.path);
            }
            throw new AppError('User not found', 404);
        }
        // Delete old profile picture if exists
        if (user.profilePicture) {
            const oldImagePath = path.join(__dirname, '..', user.profilePicture);
            try {
                await fs.unlink(oldImagePath);
            } catch (err) {
                console.error('Error deleting old profile picture:', err);
            }
        }
        // Store relative URL path (e.g., /uploads/profiles/filename.jpg)
        user.profilePicture = `/uploads/profiles/${file.filename}`;
        user.updatedAt = Date.now();
        await user.save();
        return user;
    } catch (error) {
        // Delete uploaded file if error occurs
        if (file) {
            try {
                await fs.unlink(file.path);
            } catch (err) {
                console.error('Error deleting file:', err);
            }
        }
        throw error;
    }
};

module.exports = {
    searchUsers,
    updateProfileService,
    changeProfilePictureService
};