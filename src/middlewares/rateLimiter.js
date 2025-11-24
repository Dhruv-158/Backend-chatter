const rateLimit = require('express-rate-limit');

/**
 * Rate limiter for registration attempts
 * Allows 5 registration attempts per hour per IP
 */
const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5,
    message: {
        success: false,
        message: 'Too many registration attempts. Please try again after an hour.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false
});

/**
 * Rate limiter for login attempts
 * Allows 10 login attempts per 15 minutes per IP
 */
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
    message: {
        success: false,
        message: 'Too many login attempts. Please try again after 15 minutes.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false
});

/**
 * Rate limiter for token refresh
 * Allows 20 refresh attempts per 15 minutes per IP
 */
const refreshTokenLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20,
    message: {
        success: false,
        message: 'Too many token refresh attempts. Please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false
});

/**
 * General API rate limiter
 * Allows 200 requests per 15 minutes per IP (increased for production)
 */
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200,
    message: {
        success: false,
        message: 'Too many requests. Please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false
});

/**
 * Rate limiter for friend requests
 * Allows 30 friend requests per hour per user
 */
const friendRequestLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 30,
    message: {
        success: false,
        message: 'Too many friend requests. You can send up to 30 requests per hour. Please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false
});

/**
 * Rate limiter for user search
 * Allows 60 searches per 15 minutes per user
 */
const searchLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 60,
    message: {
        success: false,
        message: 'Too many search requests. Please slow down and try again in a few minutes.'
    },
    standardHeaders: true,
    legacyHeaders: false
});

module.exports = {
    rateLimiters: {
        register: registerLimiter,
        login: loginLimiter,
        refreshToken: refreshTokenLimiter,
        general: generalLimiter,
        friendRequest: friendRequestLimiter,
        search: searchLimiter
    }
};