const express = require('express');
const router = express.Router();
const {
    checkUserOnlineStatus,
    checkMultipleUsersOnlineStatus,
    getOnlineFriends,
    getOnlineUsersCount
} = require('../controllers/onlineStatusController');
const { authenticateToken } = require('../middlewares/authMiddleware');

// All routes require authentication
router.use(authenticateToken);

/**
 * @route   GET /api/online-status/user/:userId
 * @desc    Check if a specific user is online
 * @access  Private
 */
router.get('/user/:userId', checkUserOnlineStatus);

/**
 * @route   POST /api/online-status/check-multiple
 * @desc    Check online status for multiple users
 * @access  Private
 * @body    { userIds: ['id1', 'id2', 'id3'] }
 */
router.post('/check-multiple', checkMultipleUsersOnlineStatus);

/**
 * @route   GET /api/online-status/friends
 * @desc    Get all online friends for the current user
 * @access  Private
 */
router.get('/friends', getOnlineFriends);

/**
 * @route   GET /api/online-status/count
 * @desc    Get total count of online users
 * @access  Private
 */
router.get('/count', getOnlineUsersCount);

module.exports = router;
