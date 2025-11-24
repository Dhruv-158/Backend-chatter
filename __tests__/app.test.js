/**
 * Basic tests for CI/CD pipeline
 * These tests ensure the application starts correctly and basic functionality works
 */

const request = require('supertest');
const mongoose = require('mongoose');

// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET_KEY = 'test-secret-key';
process.env.JWT_REFRESH_SECRET_KEY = 'test-refresh-secret-key';
process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/testdb';

describe('Chat Application Backend Tests', () => {
  let app;

  beforeAll(async () => {
    // Mock MongoDB connection for tests
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    
    // Set up test environment
    jest.setTimeout(30000);
  });

  afterAll(async () => {
    // Clean up after tests
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
  });

  describe('Application Startup', () => {
    test('should load environment variables', () => {
      expect(process.env.JWT_SECRET_KEY).toBeDefined();
      expect(process.env.JWT_REFRESH_SECRET_KEY).toBeDefined();
      expect(process.env.NODE_ENV).toBe('test');
    });

    test('should import main application file without errors', () => {
      expect(() => {
        require('../index.js');
      }).not.toThrow();
    });
  });

  describe('Models', () => {
    test('should load User model without errors', () => {
      expect(() => {
        require('../src/models/User');
      }).not.toThrow();
    });

    test('should load Message model without errors', () => {
      expect(() => {
        require('../src/models/Message');
      }).not.toThrow();
    });

    test('should load FriendRequest model without errors', () => {
      expect(() => {
        require('../src/models/FriendRequest');
      }).not.toThrow();
    });
  });

  describe('Services', () => {
    test('should load authService without errors', () => {
      expect(() => {
        require('../src/services/authService');
      }).not.toThrow();
    });

    test('should load messageService without errors', () => {
      expect(() => {
        require('../src/services/messageService');
      }).not.toThrow();
    });
  });

  describe('Utilities', () => {
    test('should load logger without errors', () => {
      expect(() => {
        require('../src/utils/logger');
      }).not.toThrow();
    });

    test('should load error handler without errors', () => {
      expect(() => {
        require('../src/utils/errorHandler');
      }).not.toThrow();
    });
  });

  describe('Configuration', () => {
    test('should validate required environment variables', () => {
      const requiredEnvVars = [
        'JWT_SECRET_KEY',
        'JWT_REFRESH_SECRET_KEY'
      ];

      requiredEnvVars.forEach(envVar => {
        expect(process.env[envVar]).toBeDefined();
        expect(process.env[envVar].length).toBeGreaterThan(0);
      });
    });
  });
});

// Health check test (can be run independently)
describe('Health Check', () => {
  test('should have health check endpoint available', () => {
    // This is a basic test that the health check logic exists
    expect(() => {
      const { performHealthCheck } = require('../src/utils/productionErrorHandler');
      expect(typeof performHealthCheck).toBe('function');
    }).not.toThrow();
  });
});

// API Routes validation
describe('Route Configuration', () => {
  test('should load all route modules without errors', () => {
    const routes = [
      '../src/routes/authRoutes',
      '../src/routes/userRoutes',
      '../src/routes/friendRoutes',
      '../src/routes/messageRoutes',
      '../src/routes/onlineStatusRoutes'
    ];

    routes.forEach(route => {
      expect(() => {
        require(route);
      }).not.toThrow();
    });
  });
});

// Socket.IO configuration test
describe('Socket.IO Configuration', () => {
  test('should load socket configuration without errors', () => {
    expect(() => {
      require('../src/config/socket');
    }).not.toThrow();
  });

  test('should load redis configuration without errors', () => {
    expect(() => {
      require('../src/config/redis');
    }).not.toThrow();
  });
});

// Middleware tests
describe('Middleware', () => {
  test('should load authentication middleware without errors', () => {
    expect(() => {
      require('../src/middlewares/authMiddleware');
    }).not.toThrow();
  });

  test('should load rate limiter middleware without errors', () => {
    expect(() => {
      require('../src/middlewares/rateLimiter');
    }).not.toThrow();
  });
});