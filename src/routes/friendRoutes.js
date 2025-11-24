const express = require('express');
const router = express.Router();
const friendController = require('../controllers/friendControllers');
const { authenticateToken } = require('../middlewares/authMiddleware');
const { rateLimiters } = require('../middlewares/rateLimiter');

// All routes require authentication
router.use(authenticateToken);

// Friend request routes (with rate limiting)
router.post('/request/:userId', rateLimiters.friendRequest, friendController.sendRequest);
router.put('/accept/:requestId', friendController.acceptRequest);
router.put('/reject/:requestId', friendController.rejectRequest);
router.delete('/cancel/:requestId', friendController.cancelRequest);

// Get requests
router.get('/requests/pending', friendController.getPendingRequests);
router.get('/requests/sent', friendController.getSentRequests);

// Friends management
router.get('/', friendController.getFriends);
router.delete('/remove/:userId', friendController.removeFriend);
router.get('/status/:userId', friendController.checkStatus);

module.exports = router;
