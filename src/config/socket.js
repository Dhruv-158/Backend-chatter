const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');
const Message = require('../models/Message');
const User = require('../models/User');
const { 
    redisPublisher, 
    redisSubscriber, 
    onlineUsers,
    messageCache,
    typingIndicators
} = require('./redis');

// Store active users locally (for this server instance): { userId: socketId }
const activeUsers = new Map();

// Connection monitoring for Atlas Free Tier
let totalConnections = 0;
let peakConnections = 0;

const getConnectionStats = () => {
    const current = activeUsers.size;
    if (current > peakConnections) {
        peakConnections = current;
    }
    return {
        current,
        peak: peakConnections,
        total: totalConnections
    };
};

// Store typing status: { conversationId: Set<userId> }
const typingUsers = new Map();

const setupSocket = (server) => {
    const io = new Server(server, {
        cors: {
            origin: [
                'http://localhost:5173',
                'http://localhost:5174',
                'http://localhost:3000',
                process.env.CORS_ORIGIN
            ].filter(Boolean),
            credentials: true,
            methods: ['GET', 'POST']
        },
        pingTimeout: 60000,
        pingInterval: 25000
    });

    // Socket authentication middleware
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
            
            if (!token) {
                return next(new Error('Authentication token required'));
            }

            const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);
            const userId = decoded.userId || decoded.id;
            
            if (!userId) {
                return next(new Error('Invalid token payload'));
            }
            
            const user = await User.findById(userId).select('-password');
            
            if (!user) {
                logger.error(`User not found for ID: ${userId}`);
                return next(new Error('User not found'));
            }

            socket.userId = user._id.toString();
            socket.user = user;
            next();
        } catch (error) {
            logger.error(`Socket authentication error: ${error.message}`, { error: error.stack });
            next(new Error('Authentication failed'));
        }
    });

    io.on('connection', (socket) => {
        const userId = socket.userId;
        totalConnections++;
        logger.info(`✅ User connected: ${userId} (${socket.user.username}) - Total connections: ${totalConnections}`);

        // Store active user locally
        activeUsers.set(userId, socket.id);

        // Log connection stats for Atlas monitoring
        const stats = getConnectionStats();
        logger.info(`📊 Connection Stats - Current: ${stats.current}, Peak: ${stats.peak}, Total: ${stats.total}`);

        // Add to Redis online users (across all servers)
        onlineUsers.add(userId);

        // Update user's lastSeen to current time (online)
        User.findByIdAndUpdate(userId, { lastSeen: new Date() }).catch(err => 
            logger.error(`Failed to update lastSeen: ${err.message}`)
        );

        // ✅ FIX 1: Emit user-online event (not user-status-changed)
        io.emit('user-online', { 
            userId, 
            timestamp: new Date() 
        });
        logger.info(`🟢 Broadcasted user-online: ${userId}`);

        // Join user to their personal room
        socket.join(userId);

        // Send online users to the connected user
        onlineUsers.getAll().then(users => {
            socket.emit('online-users', users);
            logger.info(`📋 Sent online users list to ${userId}: ${users.length} users`);
        });

        // Handle joining conversation rooms
        socket.on('join-conversation', async (data) => {
            try {
                const { friendId } = data;
                
                const user = await User.findById(userId);
                const isFriend = user.friends.some(f => f.toString() === friendId);
                
                if (!isFriend) {
                    socket.emit('error', { message: 'You can only chat with friends' });
                    return;
                }

                const conversationId = Message.generateConversationId(userId, friendId);
                socket.join(conversationId);
                
                logger.info(`🔗 User ${userId} joined conversation ${conversationId}`);
                socket.emit('conversation-joined', { conversationId, friendId });
            } catch (error) {
                logger.error(`Join conversation error: ${error.message}`);
                socket.emit('error', { message: 'Failed to join conversation' });
            }
        });

        // Handle leaving conversation rooms
        socket.on('leave-conversation', (data) => {
            const { friendId } = data;
            const conversationId = Message.generateConversationId(userId, friendId);
            socket.leave(conversationId);
            logger.info(`🔌 User ${userId} left conversation ${conversationId}`);
        });

        // ✅ FIX 2: Handle new messages with correct event name
        socket.on('send-message', async (data) => {
            try {
                const { messageId } = data;
                logger.info(`📤 Received send-message event with messageId: ${messageId}`);
                
                // Try to get from cache first
                let message = await messageCache.get(messageId);
                
                if (!message) {
                    // Fetch from database if not cached
                    message = await Message.findById(messageId)
                        .populate('sender', 'username profilePicture')
                        .populate('receiver', 'username profilePicture')
                        .lean(); // ✅ Use lean() for better performance

                    if (!message) {
                        socket.emit('error', { message: 'Message not found' });
                        return;
                    }
                    
                    // Cache the message
                    await messageCache.set(messageId, message, 3600);
                }

                const receiverId = message.receiver._id.toString();
                const receiverSocketId = activeUsers.get(receiverId);

                logger.info(`📨 Sending message to receiver ${receiverId}, socketId: ${receiverSocketId}`);

                // ✅ FIX 3: Emit 'receive-message' (not 'new-message')
                // ✅ FIX 4: Send message directly (not wrapped in { message: ... })
                if (receiverSocketId) {
                    io.to(receiverSocketId).emit('receive-message', message);
                    logger.info(`✅ Message delivered to ${receiverId} via receive-message event`);
                } else {
                    logger.warn(`⚠️ Receiver ${receiverId} not online, message saved but not delivered`);
                }

                // Publish to Redis if enabled (for multi-server)
                if (redisPublisher) {
                    await redisPublisher.publish('new_message', JSON.stringify({
                        message,
                        receiverId,
                        senderId: userId
                    }));
                    logger.info(`📡 Message published to Redis: ${messageId}`);
                }

            } catch (error) {
                logger.error(`❌ Send message error: ${error.message}`, error);
                socket.emit('error', { message: 'Failed to send message' });
            }
        });

        // ✅ FIX 5: Handle typing indicators with correct event names
        socket.on('typing-start', async (data) => {
            try {
                const { friendId } = data;
                const conversationId = Message.generateConversationId(userId, friendId);
                
                if (!typingUsers.has(conversationId)) {
                    typingUsers.set(conversationId, new Set());
                }
                typingUsers.get(conversationId).add(userId);

                await typingIndicators.set(conversationId, userId);

                // ✅ Emit 'typing-start' to friend (not 'user-typing')
                const friendSocketId = activeUsers.get(friendId);
                if (friendSocketId) {
                    io.to(friendSocketId).emit('typing-start', {
                        userId,
                        username: socket.user.username,
                        conversationId
                    });
                    logger.info(`⌨️ Sent typing-start to friend ${friendId}`);
                }

                // Publish to Redis if enabled
                if (redisPublisher) {
                    await redisPublisher.publish('user_typing', JSON.stringify({
                        userId,
                        username: socket.user.username,
                        friendId,
                        action: 'start'
                    }));
                }
            } catch (error) {
                logger.error(`Typing start error: ${error.message}`);
            }
        });

        socket.on('typing-stop', async (data) => {
            try {
                const { friendId } = data;
                const conversationId = Message.generateConversationId(userId, friendId);
                
                if (typingUsers.has(conversationId)) {
                    typingUsers.get(conversationId).delete(userId);
                    if (typingUsers.get(conversationId).size === 0) {
                        typingUsers.delete(conversationId);
                    }
                }

                await typingIndicators.remove(conversationId, userId);

                // ✅ Emit 'typing-stop' to friend (not 'user-stopped-typing')
                const friendSocketId = activeUsers.get(friendId);
                if (friendSocketId) {
                    io.to(friendSocketId).emit('typing-stop', {
                        userId,
                        conversationId
                    });
                    logger.info(`⏸️ Sent typing-stop to friend ${friendId}`);
                }

                // Publish to Redis if enabled
                if (redisPublisher) {
                    await redisPublisher.publish('user_typing', JSON.stringify({
                        userId,
                        friendId,
                        action: 'stop'
                    }));
                }
            } catch (error) {
                logger.error(`Typing stop error: ${error.message}`);
            }
        });

        // ✅ FIX 6: Handle message read receipts
        socket.on('mark-as-read', async (data) => {
            try {
                const { messageId } = data;
                
                const message = await Message.findById(messageId);
                if (message && message.receiver.toString() === userId && !message.isRead) {
                    message.isRead = true;
                    message.readAt = new Date();
                    await message.save();

                    // Update cache
                    await messageCache.set(messageId, message.toObject(), 3600);

                    const senderId = message.sender.toString();
                    const senderSocketId = activeUsers.get(senderId);

                    // ✅ Emit 'message-read' to sender
                    if (senderSocketId) {
                        io.to(senderSocketId).emit('message-read', {
                            messageId,
                            readAt: message.readAt
                        });
                        logger.info(`✅ Sent message-read receipt to sender ${senderId}`);
                    }

                    // Publish to Redis if enabled
                    if (redisPublisher) {
                        await redisPublisher.publish('message_read', JSON.stringify({
                            messageId,
                            readAt: message.readAt,
                            senderId
                        }));
                    }
                }
            } catch (error) {
                logger.error(`Mark read error: ${error.message}`);
            }
        });

        // ✅ FIX 7: Handle message deletion
        socket.on('delete-message', async (data) => {
            try {
                const { messageId } = data;
                
                const message = await Message.findById(messageId);
                if (!message) {
                    socket.emit('error', { message: 'Message not found' });
                    return;
                }

                const friendId = message.sender.toString() === userId 
                    ? message.receiver.toString() 
                    : message.sender.toString();
                
                // Delete from cache
                await messageCache.delete(messageId);
                
                // ✅ Emit 'message-deleted' to friend
                const friendSocketId = activeUsers.get(friendId);
                if (friendSocketId) {
                    io.to(friendSocketId).emit('message-deleted', {
                        messageId
                    });
                    logger.info(`🗑️ Sent message-deleted to friend ${friendId}`);
                }

                // Publish to Redis if enabled
                if (redisPublisher) {
                    await redisPublisher.publish('message_deleted', JSON.stringify({
                        messageId,
                        deletedBy: userId,
                        friendId
                    }));
                }

                logger.info(`🗑️ Message ${messageId} deleted by ${userId}`);
            } catch (error) {
                logger.error(`Delete message error: ${error.message}`);
            }
        });

        // ✅ FIX 8: Handle disconnect with correct event name
        socket.on('disconnect', async () => {
            logger.info(`❌ User disconnected: ${userId} (${socket.user.username})`);
            
            // Update user's lastSeen to current time (offline)
            User.findByIdAndUpdate(userId, { lastSeen: new Date() }).catch(err => 
                logger.error(`Failed to update lastSeen on disconnect: ${err.message}`)
            );
            
            // Remove from active users locally
            activeUsers.delete(userId);

            // Remove from Redis online users
            await onlineUsers.remove(userId);

            // Clean up typing status
            typingUsers.forEach((users, conversationId) => {
                users.delete(userId);
                if (users.size === 0) {
                    typingUsers.delete(conversationId);
                }
            });

            // ✅ Emit 'user-offline' (not 'user-status-changed')
            io.emit('user-offline', { 
                userId, 
                timestamp: new Date() 
            });
            logger.info(`⚫ Broadcasted user-offline: ${userId}`);

            // Publish to Redis if enabled
            if (redisPublisher) {
                await redisPublisher.publish('user_status', JSON.stringify({
                    userId,
                    isOnline: false,
                    timestamp: new Date()
                }));
            }
        });

        // Handle manual disconnect
        socket.on('manual-disconnect', () => {
            socket.disconnect();
        });
    });

    // ✅ FIX 9: Subscribe to Redis channels (only if Redis is enabled)
    if (redisSubscriber) {
        try {
            redisSubscriber.subscribe(
                'new_message',
                'message_read',
                'message_deleted',
                'user_typing',
                'user_status',
                (err, count) => {
                    if (err) {
                        logger.error(`Failed to subscribe to Redis channels: ${err.message}`, { error: err.stack });
                    } else {
                        logger.info(`✅ Subscribed to ${count} Redis channels for cross-server messaging`);
                    }
                }
            );
        } catch (error) {
            logger.error(`Error setting up Redis subscription: ${error.message}`, { error: error.stack });
        }

        // ✅ FIX 10: Handle messages from Redis Pub/Sub with correct event names
        redisSubscriber.on('message', (channel, message) => {
            try {
                const data = JSON.parse(message);

                switch (channel) {
                    case 'new_message':
                        try {
                            // ✅ Emit 'receive-message' (not 'new-message')
                            const receiverSocketId = activeUsers.get(data.receiverId);
                            if (receiverSocketId) {
                                io.to(receiverSocketId).emit('receive-message', data.message);
                                logger.info(`📨 Redis: Delivered message to ${data.receiverId}`);
                            }
                        } catch (err) {
                            logger.error(`Error handling new_message from Redis: ${err.message}`);
                        }
                        break;

                    case 'message_read':
                        try {
                            // ✅ Emit 'message-read' to sender
                            const senderSocketId = activeUsers.get(data.senderId);
                            if (senderSocketId) {
                                io.to(senderSocketId).emit('message-read', {
                                    messageId: data.messageId,
                                    readAt: data.readAt
                                });
                                logger.info(`✅ Redis: Sent read receipt to ${data.senderId}`);
                            }
                        } catch (err) {
                            logger.error(`Error handling message_read from Redis: ${err.message}`);
                        }
                        break;

                    case 'message_deleted':
                        try {
                            // ✅ Emit 'message-deleted' to friend
                            const friendSocketId = activeUsers.get(data.friendId);
                            if (friendSocketId) {
                                io.to(friendSocketId).emit('message-deleted', {
                                    messageId: data.messageId
                                });
                                logger.info(`🗑️ Redis: Sent deletion notice to ${data.friendId}`);
                            }
                        } catch (err) {
                            logger.error(`Error handling message_deleted from Redis: ${err.message}`);
                        }
                        break;

                    case 'user_typing':
                        try {
                            // ✅ Emit 'typing-start' or 'typing-stop'
                            const typingFriendSocketId = activeUsers.get(data.friendId);
                            if (typingFriendSocketId) {
                                if (data.action === 'start') {
                                    io.to(typingFriendSocketId).emit('typing-start', {
                                        userId: data.userId,
                                        username: data.username
                                    });
                                } else if (data.action === 'stop') {
                                    io.to(typingFriendSocketId).emit('typing-stop', {
                                        userId: data.userId
                                    });
                                }
                            }
                        } catch (err) {
                            logger.error(`Error handling user_typing from Redis: ${err.message}`);
                        }
                        break;

                    case 'user_status':
                        try {
                            // ✅ Emit 'user-online' or 'user-offline'
                            if (data.isOnline) {
                                io.emit('user-online', { 
                                    userId: data.userId, 
                                    timestamp: data.timestamp 
                                });
                            } else {
                                io.emit('user-offline', { 
                                    userId: data.userId, 
                                    timestamp: data.timestamp 
                                });
                            }
                            logger.info(`🔔 Redis: User ${data.userId} ${data.isOnline ? 'online' : 'offline'}`);
                        } catch (err) {
                            logger.error(`Error handling user_status from Redis: ${err.message}`);
                        }
                        break;

                    default:
                        logger.warn(`Unknown Redis channel: ${channel}`);
                }
            } catch (error) {
                logger.error(`Error processing Redis message from channel ${channel}: ${error.message}`, {
                    error: error.stack,
                    channel,
                    message: message?.substring(0, 200) // Log first 200 chars
                });
            }
        });
    } else {
        logger.warn('⚠️ Redis Pub/Sub disabled - WebSocket works on single server only');
    }

    logger.info('🚀 Socket.IO server initialized successfully');
    return io;
};

module.exports = { setupSocket, activeUsers, getConnectionStats };
