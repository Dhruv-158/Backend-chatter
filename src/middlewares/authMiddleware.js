require('dotenv').config();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { AppError } = require('../utils/errorHandler');
const logger = require('../utils/logger');

const JWT_SECRET = process.env.JWT_SECRET_KEY;

if (!JWT_SECRET) {
    throw new Error('JWT_SECRET_KEY is not defined in environment variables');
}

/**
 * Authenticate JWT token
 * @middleware
 */
const authenticateToken = async (req, res, next) => {
    try {
        // Get token from header
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({ 
                success: false,
                message: 'Access token required' 
            });
        }

        // Verify token
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // Check token type
        if (decoded.type !== 'access') {
            return res.status(403).json({ 
                success: false,
                message: 'Invalid token type' 
            });
        }

        // Attach user info to request
        req.user = { id: decoded.id };
        next();
    } catch (error) {
        logger.error(`Authentication error: ${error.message}`);
        
        if (error.name === 'JsonWebTokenError') {
            return res.status(403).json({ 
                success: false,
                message: 'Invalid token' 
            });
        }
        
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ 
                success: false,
                message: 'Token expired',
                code: 'TOKEN_EXPIRED'
            });
        }
        
        return res.status(500).json({ 
            success: false,
            message: 'Authentication failed' 
        });
    }
};

/**
 * Fetch and attach user details to request
 * @middleware
 */
const attachUserDetails = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        
        if (!user) {
            return res.status(404).json({ 
                success: false,
                message: 'User not found' 
            });
        }
        
        req.userDetails = user;
        next();
    } catch (error) {
        logger.error(`Authorization error: ${error.message}`);
        
        return res.status(500).json({ 
            success: false,
            message: 'Failed to fetch user details',
            ...(process.env.NODE_ENV === 'development' && { error: error.message })
        });
    }
};

/**
 * Optional authentication - doesn't fail if no token provided
 * @middleware
 */
const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return next();
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        
        if (decoded.type === 'access') {
            req.user = { id: decoded.id };
            
            // Optionally attach user details
            const user = await User.findById(decoded.id).select('-password');
            if (user) {
                req.userDetails = user;
            }
        }
        
        next();
    } catch (error) {
        // Continue without authentication
        next();
    }
};

/**
 * Check if user is admin (example role-based authorization)
 * @middleware
 */
const requireAdmin = async (req, res, next) => {
    try {
        if (!req.userDetails) {
            return res.status(403).json({ 
                success: false,
                message: 'Access denied' 
            });
        }
        
        if (req.userDetails.role !== 'admin') {
            return res.status(403).json({ 
                success: false,
                message: 'Admin access required' 
            });
        }
        
        next();
    } catch (error) {
        logger.error(`Admin check error: ${error.message}`);
        
        return res.status(500).json({ 
            success: false,
            message: 'Authorization check failed' 
        });
    }
};

module.exports = {
    authenticateToken,
    attachUserDetails,
    optionalAuth,
    requireAdmin
};