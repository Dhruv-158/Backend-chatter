const express = require('express');
const router = express.Router();
const authController = require('../controllers/authControllers');
const { authenticateToken, attachUserDetails } = require('../middlewares/authMiddleware');
const { validateRegistration, validateLogin, validateProfileUpdate } = require('../validators/authValidators');
const { rateLimiters } = require('../middlewares/rateLimiter');

// Public routes
router.post(
    '/register', 
    rateLimiters.register,
    validateRegistration, 
    authController.register
);

router.post(
    '/login', 
    rateLimiters.login,
    validateLogin, 
    authController.login
);

router.post(
    '/refresh-token',
    rateLimiters.refreshToken,
    authController.refreshToken
);

// Protected routes
router.post(
    '/logout',
    authenticateToken,
    authController.logout
);



module.exports = router;