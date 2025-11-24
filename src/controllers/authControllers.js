const authService = require('../services/authService');
const { validationResult } = require('express-validator');
const logger = require('../utils/logger');

/**
 * Register a new user
 * @route POST /api/auth/register
 * @access Public
 */
const register = async (req, res) => {
    try {
        // Validate request
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        const { username, email, password } = req.body;
        const result = await authService.registerService({ username, email, password });
        
        logger.info(`User registered successfully: ${email}`);
        
        return res.status(201).json({
            success: true,
            message: result.message,
            data: {
                userId: result.userId,
                username: result.username,
                email: result.email
            }
        });
    } catch (error) {
        logger.error(`Registration error: ${error.message}`);
        
        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Registration failed',
            ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
        });
    }
};

/**
 * Login user
 * @route POST /api/auth/login
 * @access Public
 */
const login = async (req, res) => {
    try {
        // Validate request
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array()
            });
        }

        const { email, password } = req.body;
        const result = await authService.loginService({ email, password });
        
        logger.info(`User logged in successfully: ${email}`);
        
        return res.status(200).json({
            success: true,
            message: 'Login successful',
            data: {
                accessToken: result.accessToken,
                refreshToken: result.refreshToken,
                user: {
                    id: result.user.id,
                    username: result.user.username,
                    email: result.user.email
                }
            }
        });
    } catch (error) {
        logger.error(`Login error: ${error.message}`);
        
        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Login failed'
        });
    }
};

/**
 * Refresh access token
 * @route POST /api/auth/refresh-token
 * @access Public
 */
const refreshToken = async (req, res) => {
    try {
        const { refreshToken } = req.body;
        
        if (!refreshToken) {
            return res.status(400).json({
                success: false,
                message: 'Refresh token is required'
            });
        }

        const result = await authService.refreshTokenService(refreshToken);
        
        return res.status(200).json({
            success: true,
            message: 'Token refreshed successfully',
            data: {
                accessToken: result.accessToken,
                refreshToken: result.refreshToken
            }
        });
    } catch (error) {
        logger.error(`Token refresh error: ${error.message}`);
        
        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Token refresh failed'
        });
    }
};

/**
 * Logout user
 * @route POST /api/auth/logout
 * @access Private
 */
const logout = async (req, res) => {
    try {
        const { refreshToken } = req.body;
        const userId = req.user.id;
        
        await authService.logoutService(userId, refreshToken);
        
        logger.info(`User logged out: ${userId}`);
        
        return res.status(200).json({
            success: true,
            message: 'Logout successful'
        });
    } catch (error) {
        logger.error(`Logout error: ${error.message}`);
        
        return res.status(error.statusCode || 500).json({
            success: false,
            message: error.message || 'Logout failed'
        });
    }
};



module.exports = {
    register,
    login,
    refreshToken,
    logout,
};