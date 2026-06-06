module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  setupFiles: ['<rootDir>/tests/setup.js'],
  testTimeout: 10000,
  verbose: true,
  collectCoverageFrom: [
    'user-service/src/**/*.js',
    'product-service/src/**/*.js',
    'cart-service/src/**/*.js',
    'order-service/src/**/*.js',
    'payment-service/src/**/*.js',
    'gateway/src/**/*.js',
    'shared/**/*.js',
  ],
};
