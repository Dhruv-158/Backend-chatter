require('dotenv').config();
const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { AppError } = require('../utils/errorHandler');

const JWT_SECRET = process.env.JWT_SECRET_KEY;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET_KEY;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

/**
 * Generate access token
 */
const generateAccessToken = (userId) => {
    return jwt.sign({ id: userId, type: 'access' }, JWT_SECRET, { 
        expiresIn: JWT_EXPIRES_IN 
    });
};

/**
 * Generate refresh token
 */
const generateRefreshToken = (userId) => {
    return jwt.sign({ id: userId, type: 'refresh' }, JWT_REFRESH_SECRET, { 
        expiresIn: JWT_REFRESH_EXPIRES_IN 
    });
};

/**
 * Register a new user
 */
const registerService = async (userData) => {
    const { username, email, password } = userData;
    
    try {
        // Check if user already exists
        const existingUser = await User.findOne({ 
            $or: [{ username }, { email }] 
        });
        
        if (existingUser) {
            if (existingUser.email === email) {
                throw new AppError('Email already registered', 400);
            }
            if (existingUser.username === username) {
                throw new AppError('Username already taken', 400);
            }
        }

        // Validate password strength
        if (password.length < 8) {
            throw new AppError('Password must be at least 8 characters long', 400);
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12);
        
        // Create new user
        const newUser = new User({
            username,
            email: email.toLowerCase(),
            password: hashedPassword,
        });
        
        await newUser.save();
        
        return { 
            message: 'User registered successfully',
            userId: newUser._id,
            username: newUser.username,
            email: newUser.email
        };
    } catch (error) {
        throw error;
    }
};

/**
 * Login user
 */
const loginService = async (credentials) => {
    const { email, password } = credentials;
    
    try {
        // Find user by email
        const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
        
        if (!user) {
            throw new AppError('Invalid email or password', 401);
        }
        
        // Verify password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        
        if (!isPasswordValid) {
            throw new AppError('Invalid email or password', 401);
        }
        
        // Generate tokens
        const accessToken = generateAccessToken(user._id);
        const refreshToken = generateRefreshToken(user._id);
        
        // Store refresh token in database
        await RefreshToken.create({
            userId: user._id,
            token: refreshToken,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
        });
        
        // Update last login
        user.lastLogin = Date.now();
        await user.save();
        
        return { 
            accessToken,
            refreshToken,
            user: {
                id: user._id,
                username: user.username,
                email: user.email
            }
        };
    } catch (error) {
        throw error;
    }
};

/**
 * Refresh access token
 */
const refreshTokenService = async (token) => {
    try {
        // Verify refresh token
        const decoded = jwt.verify(token, JWT_REFRESH_SECRET);
        
        if (decoded.type !== 'refresh') {
            throw new AppError('Invalid token type', 401);
        }
        
        // Check if refresh token exists in database
        const storedToken = await RefreshToken.findOne({ 
            token, 
            userId: decoded.id,
            expiresAt: { $gt: Date.now() }
        });
        
        if (!storedToken) {
            throw new AppError('Invalid or expired refresh token', 401);
        }
        
        // Generate new tokens
        const newAccessToken = generateAccessToken(decoded.id);
        const newRefreshToken = generateRefreshToken(decoded.id);
        
        // Delete old refresh token and store new one
        await RefreshToken.deleteOne({ token });
        await RefreshToken.create({
            userId: decoded.id,
            token: newRefreshToken,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        });
        
        return {
            accessToken: newAccessToken,
            refreshToken: newRefreshToken
        };
    } catch (error) {
        if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
            throw new AppError('Invalid or expired refresh token', 401);
        }
        throw error;
    }
};

/**
 * Logout user
 */
const logoutService = async (userId, refreshToken) => {
    try {
        // Delete refresh token from database
        if (refreshToken) {
            await RefreshToken.deleteOne({ userId, token: refreshToken });
        } else {
            // Delete all refresh tokens for user (logout from all devices)
            await RefreshToken.deleteMany({ userId });
        }
        
        return { message: 'Logout successful' };
    } catch (error) {
        throw error;
    }
};


module.exports = {
    registerService,
    loginService,
    refreshTokenService,
    logoutService,
};