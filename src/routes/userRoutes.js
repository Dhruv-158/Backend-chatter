const express = require('express');
const router = express.Router();
const userController = require('../controllers/userControllers');
const { authenticateToken, attachUserDetails } = require('../middlewares/authMiddleware');
const { validateProfileUpdate } = require('../validators/authValidators');
const { rateLimiters } = require('../middlewares/rateLimiter');
const upload = require('../utils/multer');

// Search users (with rate limiting)
router.get(
    '/search',
    authenticateToken,
    rateLimiters.search,
    userController.searchUsers
);

router.get(
    '/profile',
    authenticateToken,
    attachUserDetails,
    userController.getProfile
);

router.put(
    '/profile',
    authenticateToken,
    attachUserDetails,
    validateProfileUpdate,
    userController.updateProfile
);

router.put(
    '/profile/picture',
    authenticateToken,
    attachUserDetails,
    upload.single('profilePicture'),
    userController.changeProfilePicture
);

module.exports = router;