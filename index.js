require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const compression = require('compression');
const morgan = require('morgan');
const http = require('http');
const logger = require('./src/utils/logger');
const { errorHandler, notFoundHandler } = require('./src/utils/errorHandler');
const { rateLimiters } = require('./src/middlewares/rateLimiter');
const { setupSocket } = require('./src/config/socket');
const { shutdown: shutdownRedis } = require('./src/config/redis');

// Import routes
const authRoutes = require('./src/routes/authRoutes');
const userRoutes = require('./src/routes/userRoutes');
const friendRoutes = require('./src/routes/friendRoutes');
const messageRoutes = require('./src/routes/messageRoutes');
const onlineStatusRoutes = require('./src/routes/onlineStatusRoutes');

const app = express();
const PORT = process.env.PORT || 5500;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.IO
const io = setupSocket(server);

// CORS Configuration - MUST BE BEFORE OTHER MIDDLEWARE
const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps, Postman, curl)
        if (!origin) return callback(null, true);
        
        const allowedOrigins = [
            'http://localhost:5173',
            'http://localhost:5174',
            'http://localhost:3000',
            process.env.CORS_ORIGIN
        ].filter(Boolean); // Remove undefined values
        
        if (allowedOrigins.indexOf(origin) !== -1) {
            // ✅ Allow this origin
            callback(null, true);
        } else {
            // ❌ Reject silently (don't crash, just block)
            logger.warn(`CORS blocked request from origin: ${origin}`);
            callback(null, false); // Return false instead of throwing error
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
    maxAge: 86400, // 24 hours
    optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // Handle preflight requests

// Security middleware (AFTER CORS)
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Body parser middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve uploaded files statically with CORS enabled (for both /uploads and /api/uploads)
app.use('/uploads', cors(corsOptions), express.static('uploads', {
    setHeaders: (res, path) => {
        res.set('Cross-Origin-Resource-Policy', 'cross-origin');
        res.set('Access-Control-Allow-Origin', '*');
    }
}));
app.use('/api/uploads', cors(corsOptions), express.static('uploads', {
    setHeaders: (res, path) => {
        res.set('Cross-Origin-Resource-Policy', 'cross-origin');
        res.set('Access-Control-Allow-Origin', '*');
    }
}));

// Data sanitization against NoSQL injection
app.use(mongoSanitize());

// Compression middleware
app.use(compression());

// HTTP request logger (only in development)
if (NODE_ENV === 'development') {
    app.use(morgan('dev'));
} else {
    app.use(morgan('combined', {
        stream: {
            write: (message) => logger.info(message.trim())
        }
    }));
}

// Apply general rate limiting to all routes
app.use(rateLimiters.general);

// Root endpoint - API info
app.get('/', (req, res) => {
    res.status(200).json({
        message: 'Chattr Backend API',
        status: 'running',
        version: process.env.npm_package_version || '1.0.0',
        environment: NODE_ENV,
        endpoints: {
            health: '/health',
            auth: '/api/auth',
            users: '/api/user',
            friends: '/api/friends',
            messages: '/api/messages',
            status: '/api/online-status'
        },
        documentation: 'https://github.com/Dhruv-158/Backend-chatter'
    });
});

// Favicon handler (prevents 404s)
app.get('/favicon.ico', (req, res) => {
    res.status(204).send();
});

// Health check endpoint with comprehensive monitoring
app.get('/health', async (req, res) => {
    try {
        // Basic MongoDB connection check
        const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
        
        const health = {
            status: dbStatus === 'connected' ? 'healthy' : 'unhealthy',
            timestamp: new Date().toISOString(),
            database: dbStatus,
            atlas: {
                connected: dbStatus === 'connected',
                host: mongoose.connection.host || 'not connected',
                readyState: mongoose.connection.readyState,
                connectionCount: mongoose.connections.length
            }
        };
        
        // Add detailed connection info if connected
        if (dbStatus === 'connected') {
            health.atlas.name = mongoose.connection.name;
            health.atlas.port = mongoose.connection.port;
        }
        
        // Add Socket.IO connection stats for Atlas monitoring
        try {
            const { getConnectionStats } = require('./src/config/socket');
            const connectionStats = getConnectionStats();
            health.socketConnections = connectionStats;
            
            // Atlas Free Tier warning if connections are high
            if (connectionStats.current > 20) {
                health.atlasWarning = 'High connection count - consider Atlas upgrade for better performance';
            }
        } catch (socketError) {
            health.socketConnections = { error: 'Socket stats unavailable' };
        }
        
        const statusCode = health.status === 'healthy' ? 200 : 503;
        
        res.status(statusCode).json({
            ...health,
            environment: NODE_ENV,
            version: process.env.npm_package_version || '1.0.0'
        });
    } catch (error) {
        logger.error('Health check endpoint error:', error.message);
        res.status(503).json({
            status: 'unhealthy',
            message: 'Health check failed',
            error: error.message,
            atlas: {
                connected: false,
                issue: 'Possible IP whitelist or authentication problem'
            },
            timestamp: new Date().toISOString(),
            environment: NODE_ENV
        });
    }
});

// Favicon handler (prevents 404s)
app.get('/favicon.ico', (req, res) => {
    res.status(204).send(); // No content response
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/online-status', onlineStatusRoutes);

// 404 handler
app.use(notFoundHandler);

// Global error handler (must be last)
app.use(errorHandler);

// Database connection
const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            // Optimized for Atlas Free Tier (M0)
            maxPoolSize: 5, // Reduced for free tier connection limits
            minPoolSize: 1, // Keep minimum connections
            maxIdleTimeMS: 30000, // Close idle connections faster
            serverSelectionTimeoutMS: 5000, // Quick timeout for server selection
            socketTimeoutMS: 45000, // Socket timeout
        });
        
        logger.info(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        logger.error(`MongoDB Connection Error: ${error.message}`);
        process.exit(1);
    }
};

// Connect to database
connectDB();

// Mongoose connection event handlers
mongoose.connection.on('error', (err) => {
    logger.error(`MongoDB connection error: ${err}`);
});

mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected');
});

// Graceful shutdown
// Start server
server.listen(PORT, () => {
    logger.info(`Server running in ${NODE_ENV} mode on port ${PORT}`);
    logger.info(`WebSocket server ready on port ${PORT}`);
    logger.info(`Redis Pub/Sub enabled for horizontal scaling`);
    logger.info(`CORS enabled for: http://localhost:5173`);
});

module.exports = { app, io };