const User = require('../models/User');
const FriendRequest = require('../models/FriendRequest');
const { AppError } = require('../utils/errorHandler');
const { onlineUsers } = require('../config/redis');

/**
 * Send a friend request
 */
const sendFriendRequest = async (senderId, receiverId) => {
    try {
        // Validate: Can't send request to yourself
        if (senderId === receiverId) {
            throw new AppError('You cannot send a friend request to yourself', 400);
        }
        // Check if receiver exists
        const receiver = await User.findById(receiverId);
        if (!receiver) {
            throw new AppError('The user you are trying to add does not exist or has been deleted', 404);
        }
        // Check if already friends
        const sender = await User.findById(senderId);
        if (!sender) {
            throw new AppError('Your account was not found. Please log in again', 404);
        }
        if (sender.friends.includes(receiverId)) {
            throw new AppError(`You are already friends with ${receiver.username}`, 400);
        }
        // Check if request already exists
        const existingRequest = await FriendRequest.findOne({
            $or: [
                { sender: senderId, receiver: receiverId },
                { sender: receiverId, receiver: senderId }
            ]
        });
        if (existingRequest) {
            if (existingRequest.status === 'pending') {
                if (existingRequest.sender.toString() === senderId) {
                    throw new AppError(`You have already sent a friend request to ${receiver.username}. Please wait for their response`, 400);
                } else {
                    throw new AppError(`${receiver.username} has already sent you a friend request. Please check your pending requests to accept it`, 400);
                }
            }
            if (existingRequest.status === 'accepted') {
                throw new AppError(`You are already friends with ${receiver.username}`, 400);
            }
            // If rejected, allow sending again - delete old request
            await FriendRequest.deleteOne({ _id: existingRequest._id });
        }

        // Create new friend request
        const friendRequest = new FriendRequest({
            sender: senderId,
            receiver: receiverId,
            status: 'pending'
        });

        await friendRequest.save();

        // Populate sender info for response
        await friendRequest.populate('sender', 'username email profilePicture');

        return friendRequest;
    } catch (error) {
        throw error;
    }
};

/**
 * Accept a friend request
 */
const acceptFriendRequest = async (requestId, userId) => {
    try {
        const friendRequest = await FriendRequest.findById(requestId);

        if (!friendRequest) {
            throw new AppError('Friend request not found. It may have been cancelled or already processed', 404);
        }

        // Verify that the current user is the receiver
        if (friendRequest.receiver.toString() !== userId) {
            throw new AppError('You are not authorized to accept this friend request. Only the recipient can accept', 403);
        }

        if (friendRequest.status !== 'pending') {
            throw new AppError(`This friend request has already been ${friendRequest.status}`, 400);
        }

        // Update request status
        friendRequest.status = 'accepted';
        friendRequest.updatedAt = Date.now();
        await friendRequest.save();

        // Add each user to the other's friends list
        await User.findByIdAndUpdate(friendRequest.sender, {
            $addToSet: { friends: friendRequest.receiver }
        });

        await User.findByIdAndUpdate(friendRequest.receiver, {
            $addToSet: { friends: friendRequest.sender }
        });

        // Populate sender and receiver info
        await friendRequest.populate('sender', 'username email profilePicture');
        await friendRequest.populate('receiver', 'username email profilePicture');

        return friendRequest;
    } catch (error) {
        throw error;
    }
};

/**
 * Reject a friend request
 */
const rejectFriendRequest = async (requestId, userId) => {
    try {
        const friendRequest = await FriendRequest.findById(requestId);

        if (!friendRequest) {
            throw new AppError('Friend request not found. It may have been cancelled or already processed', 404);
        }

        // Verify that the current user is the receiver
        if (friendRequest.receiver.toString() !== userId) {
            throw new AppError('You are not authorized to reject this friend request. Only the recipient can reject', 403);
        }

        if (friendRequest.status !== 'pending') {
            throw new AppError(`This friend request has already been ${friendRequest.status}`, 400);
        }

        // Update request status
        friendRequest.status = 'rejected';
        friendRequest.updatedAt = Date.now();
        await friendRequest.save();

        return friendRequest;
    } catch (error) {
        throw error;
    }
};

/**
 * Cancel a friend request (sender cancels)
 */
const cancelFriendRequest = async (requestId, userId) => {
    try {
        const friendRequest = await FriendRequest.findById(requestId);

        if (!friendRequest) {
            throw new AppError('Friend request not found. It may have already been processed or cancelled', 404);
        }

        // Verify that the current user is the sender
        if (friendRequest.sender.toString() !== userId) {
            throw new AppError('You can only cancel friend requests that you sent', 403);
        }

        if (friendRequest.status !== 'pending') {
            throw new AppError(`This friend request has already been ${friendRequest.status} and cannot be cancelled`, 400);
        }

        // Delete the request
        await FriendRequest.deleteOne({ _id: requestId });

        return { message: 'Friend request cancelled successfully' };
    } catch (error) {
        throw error;
    }
};

/**
 * Get pending friend requests (received)
 */
const getPendingRequests = async (userId, page = 1, limit = 20) => {
    try {
        const skip = (page - 1) * limit;
        
        const requests = await FriendRequest.find({
            receiver: userId,
            status: 'pending'
        })
            .populate('sender', 'username email profilePicture bio')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const total = await FriendRequest.countDocuments({
            receiver: userId,
            status: 'pending'
        });

        return {
            requests,
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
 * Get sent friend requests
 */
const getSentRequests = async (userId, page = 1, limit = 20) => {
    try {
        const skip = (page - 1) * limit;
        
        const requests = await FriendRequest.find({
            sender: userId,
            status: 'pending'
        })
            .populate('receiver', 'username email profilePicture bio')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const total = await FriendRequest.countDocuments({
            sender: userId,
            status: 'pending'
        });

        return {
            requests,
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
 * Get friends list
 */
const getFriendsList = async (userId, page = 1, limit = 50) => {
    try {
        const skip = (page - 1) * limit;
        
        const user = await User.findById(userId)
            .populate({
                path: 'friends',
                select: 'username email profilePicture bio lastLogin lastSeen',
                options: {
                    skip: skip,
                    limit: limit,
                    sort: { username: 1 }
                }
            })
            .select('friends');

        if (!user) {
            throw new AppError('User not found', 404);
        }

        // Add online status to each friend
        const friendsWithStatus = await Promise.all(
            user.friends.map(async (friend) => ({
                ...friend.toObject(),
                isOnline: await onlineUsers.isOnline(friend._id.toString())
            }))
        );

        const totalFriends = await User.findById(userId).select('friends');
        const total = totalFriends.friends.length;

        return {
            friends: friendsWithStatus,
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
 * Remove a friend
 */
const removeFriend = async (userId, friendId) => {
    try {
        const user = await User.findById(userId);
        const friend = await User.findById(friendId);

        if (!user) {
            throw new AppError('Your account was not found. Please log in again', 404);
        }

        if (!friend) {
            throw new AppError('The user you are trying to remove does not exist', 404);
        }

        // Check if they are actually friends
        if (!user.friends.includes(friendId)) {
            throw new AppError(`${friend.username} is not in your friends list`, 400);
        }

        // Remove friendId from userId's friends list
        await User.findByIdAndUpdate(userId, {
            $pull: { friends: friendId }
        });

        // Remove userId from friendId's friends list
        await User.findByIdAndUpdate(friendId, {
            $pull: { friends: userId }
        });

        // Delete any friend requests between them
        await FriendRequest.deleteMany({
            $or: [
                { sender: userId, receiver: friendId },
                { sender: friendId, receiver: userId }
            ]
        });

        return { message: `${friend.username} has been removed from your friends list` };
    } catch (error) {
        throw error;
    }
};

/**
 * Check friendship status between two users
 */
const checkFriendshipStatus = async (userId, targetUserId) => {
    try {
        const user = await User.findById(userId);
        
        // Check if already friends
        if (user.friends.includes(targetUserId)) {
            return { status: 'friends' };
        }

        // Check for pending request
        const request = await FriendRequest.findOne({
            $or: [
                { sender: userId, receiver: targetUserId, status: 'pending' },
                { sender: targetUserId, receiver: userId, status: 'pending' }
            ]
        });

        if (request) {
            if (request.sender.toString() === userId) {
                return { status: 'request_sent' };
            } else {
                return { status: 'request_received', requestId: request._id };
            }
        }

        return { status: 'not_friends' };
    } catch (error) {
        throw error;
    }
};

module.exports = {
    sendFriendRequest,
    acceptFriendRequest,
    rejectFriendRequest,
    cancelFriendRequest,
    getPendingRequests,
    getSentRequests,
    getFriendsList,
    removeFriend,
    checkFriendshipStatus
};
