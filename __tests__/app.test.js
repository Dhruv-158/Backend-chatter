/**
 * Basic tests for CI/CD pipeline - No database required
 * These tests ensure the application modules load correctly
 */

// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET_KEY = 'test-secret-key';
process.env.JWT_REFRESH_SECRET_KEY = 'test-refresh-secret-key';
process.env.MONGODB_URI = 'mongodb://localhost:27017/testdb';

describe('Chat Application Backend Tests', () => {
  
  describe('Environment Configuration', () => {
    test('should load environment variables', () => {
      expect(process.env.JWT_SECRET_KEY).toBeDefined();
      expect(process.env.JWT_REFRESH_SECRET_KEY).toBeDefined();
      expect(process.env.NODE_ENV).toBe('test');
    });

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

  describe('Module Loading', () => {
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

    test('should load authService without errors', () => {
      expect(() => {
        require('../src/services/authService');
      }).not.toThrow();
    });

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

  describe('Basic Functionality', () => {
    test('should validate Node.js version compatibility', () => {
      const nodeVersion = process.version;
      const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
      expect(majorVersion).toBeGreaterThanOrEqual(14);
    });

    test('should have package.json with correct structure', () => {
      const packageJson = require('../package.json');
      expect(packageJson.name).toBeDefined();
      expect(packageJson.version).toBeDefined();
      expect(packageJson.main).toBe('index.js');
      expect(packageJson.scripts).toBeDefined();
      expect(packageJson.dependencies).toBeDefined();
    });
  });
});