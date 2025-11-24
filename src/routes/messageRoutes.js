const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageControllers');
const { authenticateToken } = require('../middlewares/authMiddleware');
const { rateLimiters } = require('../middlewares/rateLimiter');
const { 
    uploadImage, 
    uploadVideo, 
    uploadDocument, 
    uploadAudio 
} = require('../utils/fileUpload');

// All routes require authentication
router.use(authenticateToken);

// Send messages (with rate limiting)
router.post('/text/:friendId', rateLimiters.general, messageController.sendTextMessage);
router.post('/image/:friendId', rateLimiters.general, uploadImage.single('image'), messageController.sendImageMessage);
router.post('/video/:friendId', rateLimiters.general, uploadVideo.single('video'), messageController.sendVideoMessage);
router.post('/document/:friendId', rateLimiters.general, uploadDocument.single('document'), messageController.sendDocumentMessage);
router.post('/audio/:friendId', rateLimiters.general, uploadAudio.single('audio'), messageController.sendAudioMessage);
router.post('/link/:friendId', rateLimiters.general, messageController.sendLinkMessage);

// Get messages
router.get('/conversations', messageController.getConversations);  // ✅ Chat list with unread per friend
router.get('/conversation/:friendId', messageController.getMessages);  // ✅ Chat history with one friend
// ❌ REMOVED: /unread/count - Use conversations API instead

// Mark as read
router.put('/:messageId/read', messageController.markAsRead);
router.put('/:friendId/read-all', messageController.markConversationAsRead);

// Delete message
router.delete('/:messageId', messageController.deleteMessage);

module.exports = router;
