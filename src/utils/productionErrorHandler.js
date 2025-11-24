/**
 * Production Error Handler - Prevents server crashes and provides secure error responses
 * This file contains utilities for handling unexpected errors in production
 */

const logger = require('./logger');

/**
 * Global exception handler for unhandled promise rejections
 */
const handleUnhandledRejection = (server, io, shutdownRedis) => {
    process.on('unhandledRejection', async (reason, promise) => {
        logger.error('🚨 Unhandled Promise Rejection detected:', {
            reason: reason?.message || reason,
            stack: reason?.stack,
            promise: promise?.toString(),
            timestamp: new Date().toISOString()
        });

        // Graceful shutdown
        logger.info('🛑 Starting graceful shutdown due to unhandled rejection...');
        
        try {
            // Close all connections gracefully
            if (io) {
                io.close(() => {
                    logger.info('✅ Socket.IO server closed');
                });
            }

            if (shutdownRedis) {
                await shutdownRedis();
            }

            if (server) {
                server.close((err) => {
                    if (err) {
                        logger.error('❌ Error during server shutdown:', err.message);
                    } else {
                        logger.info('✅ HTTP server closed');
                    }
                    process.exit(1);
                });

                // Force exit after 30 seconds
                setTimeout(() => {
                    logger.error('⏰ Forced shutdown after timeout');
                    process.exit(1);
                }, 30000);
            } else {
                process.exit(1);
            }
        } catch (shutdownError) {
            logger.error('❌ Error during graceful shutdown:', shutdownError.message);
            process.exit(1);
        }
    });
};

/**
 * Global exception handler for uncaught exceptions
 */
const handleUncaughtException = () => {
    process.on('uncaughtException', (error) => {
        logger.error('🚨 Uncaught Exception detected:', {
            name: error.name,
            message: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString()
        });

        // Log critical error and exit immediately
        console.error('💀 FATAL ERROR - Uncaught Exception:', error.message);
        process.exit(1);
    });
};

/**
 * Graceful shutdown handler for SIGTERM and SIGINT
 */
const handleGracefulShutdown = (server, io, shutdownRedis) => {
    const shutdown = async (signal) => {
        logger.info(`📡 ${signal} signal received: starting graceful shutdown`);

        try {
            // Stop accepting new connections
            if (server) {
                server.close(() => {
                    logger.info('✅ HTTP server stopped accepting new connections');
                });
            }

            // Close Socket.IO
            if (io) {
                io.close(() => {
                    logger.info('✅ Socket.IO server closed');
                });
            }

            // Close Redis connections
            if (shutdownRedis) {
                await shutdownRedis();
            }

            // Close MongoDB connection
            const mongoose = require('mongoose');
            await mongoose.connection.close();
            logger.info('✅ MongoDB connection closed');

            logger.info('🏁 Graceful shutdown completed');
            process.exit(0);

        } catch (error) {
            logger.error('❌ Error during graceful shutdown:', error.message);
            process.exit(1);
        }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
};

/**
 * Production-safe error response formatter
 */
const formatErrorResponse = (error, isDevelopment = false) => {
    const response = {
        success: false,
        message: 'Internal server error',
        timestamp: new Date().toISOString()
    };

    // In development, include more details
    if (isDevelopment) {
        response.error = {
            message: error.message,
            stack: error.stack,
            name: error.name
        };
    } else {
        // In production, only show safe messages
        if (error.statusCode && error.statusCode < 500) {
            response.message = error.message;
        } else {
            response.message = 'Something went wrong. Please try again later.';
        }
    }

    return response;
};

/**
 * Async wrapper to catch errors in async route handlers
 */
const catchAsync = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch((error) => {
            logger.error('🔴 Async route error:', {
                route: req.route?.path || req.path,
                method: req.method,
                error: error.message,
                stack: error.stack,
                userId: req.user?.id,
                timestamp: new Date().toISOString()
            });
            next(error);
        });
    };
};

/**
 * Database connection health check with Atlas Free Tier monitoring
 */
const checkDatabaseHealth = async () => {
    try {
        const mongoose = require('mongoose');
        
        if (mongoose.connection.readyState !== 1) {
            throw new Error('Database not connected');
        }

        // Simple ping to check connection
        await mongoose.connection.db.admin().ping();
        
        // Get connection stats for Atlas monitoring
        const stats = mongoose.connection.db.stats ? await mongoose.connection.db.stats() : {};
        const connectionCount = mongoose.connections.length;
        
        return { 
            healthy: true, 
            message: 'Database connection healthy',
            connectionCount,
            atlasStats: {
                collections: stats.collections || 0,
                dataSize: stats.dataSize || 0,
                indexSize: stats.indexSize || 0
            }
        };
    } catch (error) {
        return { 
            healthy: false, 
            message: 'Database connection unhealthy',
            error: error.message 
        };
    }
};

/**
 * System health check for monitoring
 */
const performHealthCheck = async () => {
    const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        checks: {}
    };

    try {
        // Check database
        health.checks.database = await checkDatabaseHealth();
        
        // Check Redis (if enabled)
        const { redisClient } = require('../config/redis');
        if (redisClient) {
            try {
                await redisClient.ping();
                health.checks.redis = { healthy: true, message: 'Redis connection healthy' };
            } catch (error) {
                health.checks.redis = { 
                    healthy: false, 
                    message: 'Redis connection unhealthy',
                    error: error.message 
                };
            }
        } else {
            health.checks.redis = { healthy: true, message: 'Redis disabled' };
        }

        // Overall health status
        const allHealthy = Object.values(health.checks).every(check => check.healthy);
        health.status = allHealthy ? 'healthy' : 'degraded';

    } catch (error) {
        logger.error('Health check error:', error.message);
        health.status = 'unhealthy';
        health.error = error.message;
    }

    return health;
};

module.exports = {
    handleUnhandledRejection,
    handleUncaughtException,
    handleGracefulShutdown,
    formatErrorResponse,
    catchAsync,
    performHealthCheck
};