// Runs before each test file. Sets env vars so the shared/middleware/auth
// module (which requires JWT_SECRET at load time) can be required.
process.env.JWT_SECRET = 'test-jwt-secret-1234';
process.env.JWT_EXPIRES_IN = '1h';
process.env.NODE_ENV = 'test';
