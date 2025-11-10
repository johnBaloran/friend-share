// Test setup file - runs before all tests
import dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Set test environment
process.env.NODE_ENV = 'test';

// Increase timeout for integration tests
jest.setTimeout(30000);

// Mock external services if needed
beforeAll(async () => {
  // Setup test database connection, etc.
});

afterAll(async () => {
  // Close database connections, cleanup, etc.
});
