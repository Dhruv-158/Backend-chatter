const Redis = require('ioredis');
const logger = require('../utils/logger');

// ✅ Check if Redis is enabled (set REDIS_ENABLED=false in .env to disable)
const REDIS_ENABLED = process.env.REDIS_ENABLED !== 'false';

// Redis configuration
const redisConfig = (() => {
    // Check if we have a Redis URL (common in production)
    if (process.env.REDIS_URL) {
        return {
            ...require('url').parse(process.env.REDIS_URL),
            retryStrategy(times) {
                // ✅ Stop retrying after 3 attempts in development
                if (!REDIS_ENABLED || times > 3) {
                    logger.warn('Redis connection failed - Running without Redis (WebSocket will work on single server only)');
                    return null; // Stop retrying
                }
                const delay = Math.min(times * 50, 2000);
                return delay;
            },
            maxRetriesPerRequest: 3,
            enableReadyCheck: true,
            lazyConnect: true, // ✅ Don't connect immediately
            enableOfflineQueue: false, // ✅ Fail fast if Redis is not available
            connectTimeout: 10000, // 10 second timeout
            commandTimeout: 5000,  // 5 second command timeout
        };
    }
    
    // Fallback to individual config values
    return {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        retryStrategy(times) {
            // ✅ Stop retrying after 3 attempts in development
            if (!REDIS_ENABLED || times > 3) {
                logger.warn('Redis connection failed - Running without Redis (WebSocket will work on single server only)');
                return null; // Stop retrying
            }
            const delay = Math.min(times * 50, 2000);
            return delay;
        },
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        lazyConnect: true, // ✅ Don't connect immediately
        enableOfflineQueue: false, // ✅ Fail fast if Redis is not available
        connectTimeout: 10000, // 10 second timeout
        commandTimeout: 5000,  // 5 second command timeout
    };
})();

// Create Redis clients (only if enabled)
let redisClient, redisPublisher, redisSubscriber;

if (REDIS_ENABLED) {
    redisClient = new Redis(redisConfig);
    redisPublisher = new Redis(redisConfig);
    redisSubscriber = new Redis(redisConfig);

    // Redis client event handlers
    redisClient.on('connect', () => {
        logger.info('Redis client connected');
    });

    redisClient.on('error', (err) => {
        logger.error(`Redis client error: ${err.message}`);
    });

    redisClient.on('ready', () => {
        logger.info('Redis client ready');
    });

    // Publisher event handlers
    redisPublisher.on('connect', () => {
        logger.info('Redis publisher connected');
    });

    redisPublisher.on('error', (err) => {
        logger.error(`Redis publisher error: ${err.message}`);
    });

    // Subscriber event handlers
    redisSubscriber.on('connect', () => {
        logger.info('Redis subscriber connected');
    });

    redisSubscriber.on('error', (err) => {
        logger.error(`Redis subscriber error: ${err.message}`);
    });

    // Try to connect
    redisClient.connect().catch((err) => {
        logger.warn(`Redis connection failed: ${err.message} - Running without Redis`);
    });
    redisPublisher.connect().catch((err) => {
        logger.warn(`Redis publisher connection failed: ${err.message}`);
    });
    redisSubscriber.connect().catch((err) => {
        logger.warn(`Redis subscriber connection failed: ${err.message}`);
    });
} else {
    logger.warn('Redis is disabled - Running in single-server mode (WebSocket works on single server only)');
    // Create mock clients
    redisClient = null;
    redisPublisher = null;
    redisSubscriber = null;
}

// Helper functions for online users
const onlineUsers = {
    // Add user to online set
    add: async (userId) => {
        if (!redisClient) return; // Skip if Redis disabled
        try {
            await redisClient.sadd('online_users', userId);
            await redisClient.hset('user_sessions', userId, Date.now());
            logger.info(`User ${userId} added to online users`);
        } catch (error) {
            logger.error(`Failed to add online user: ${error.message}`);
        }
    },

    // Remove user from online set
    remove: async (userId) => {
        if (!redisClient) return; // Skip if Redis disabled
        try {
            await redisClient.srem('online_users', userId);
            await redisClient.hdel('user_sessions', userId);
            logger.info(`User ${userId} removed from online users`);
        } catch (error) {
            logger.error(`Failed to remove online user: ${error.message}`);
        }
    },

    // Check if user is online
    isOnline: async (userId) => {
        if (!redisClient) return false; // Return false if Redis disabled
        try {
            return await redisClient.sismember('online_users', userId);
        } catch (error) {
            logger.error(`Failed to check online status: ${error.message}`);
            return false;
        }
    },

    // Get all online users
    getAll: async () => {
        if (!redisClient) return []; // Return empty array if Redis disabled
        try {
            return await redisClient.smembers('online_users');
        } catch (error) {
            logger.error(`Failed to get online users: ${error.message}`);
            return [];
        }
    },

    // Get count of online users
    count: async () => {
        if (!redisClient) return 0; // Return 0 if Redis disabled
        try {
            return await redisClient.scard('online_users');
        } catch (error) {
            logger.error(`Failed to count online users: ${error.message}`);
            return 0;
        }
    }
};

// Helper functions for message caching
const messageCache = {
    // Cache a message
    set: async (messageId, messageData, ttl = 3600) => {
        if (!redisClient) return; // Skip if Redis disabled
        try {
            await redisClient.setex(
                `message:${messageId}`,
                ttl,
                JSON.stringify(messageData)
            );
        } catch (error) {
            logger.error(`Failed to cache message: ${error.message}`);
        }
    },

    // Get cached message
    get: async (messageId) => {
        if (!redisClient) return null; // Return null if Redis disabled
        try {
            const data = await redisClient.get(`message:${messageId}`);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            logger.error(`Failed to get cached message: ${error.message}`);
            return null;
        }
    },

    // Delete cached message
    delete: async (messageId) => {
        if (!redisClient) return; // Skip if Redis disabled
        try {
            await redisClient.del(`message:${messageId}`);
        } catch (error) {
            logger.error(`Failed to delete cached message: ${error.message}`);
        }
    }
};

// Helper functions for typing indicators
const typingIndicators = {
    // Set typing status (expires after 5 seconds)
    set: async (conversationId, userId) => {
        if (!redisClient) return; // Skip if Redis disabled
        try {
            await redisClient.setex(
                `typing:${conversationId}:${userId}`,
                5,
                '1'
            );
        } catch (error) {
            logger.error(`Failed to set typing indicator: ${error.message}`);
        }
    },

    // Remove typing status
    remove: async (conversationId, userId) => {
        if (!redisClient) return; // Skip if Redis disabled
        try {
            await redisClient.del(`typing:${conversationId}:${userId}`);
        } catch (error) {
            logger.error(`Failed to remove typing indicator: ${error.message}`);
        }
    },

    // Check if user is typing
    isTyping: async (conversationId, userId) => {
        if (!redisClient) return false; // Return false if Redis disabled
        try {
            const exists = await redisClient.exists(`typing:${conversationId}:${userId}`);
            return exists === 1;
        } catch (error) {
            logger.error(`Failed to check typing status: ${error.message}`);
            return false;
        }
    }
};

// Graceful shutdown
const shutdown = async () => {
    if (!REDIS_ENABLED || !redisClient) {
        logger.info('Redis is disabled - No connections to close');
        return;
    }
    try {
        logger.info('Closing Redis connections...');
        await redisClient.quit();
        await redisPublisher.quit();
        await redisSubscriber.quit();
        logger.info('Redis connections closed');
    } catch (error) {
        logger.error(`Error closing Redis connections: ${error.message}`);
    }
};

module.exports = {
    redisClient,
    redisPublisher,
    redisSubscriber,
    onlineUsers,
    messageCache,
    typingIndicators,
    shutdown
};
