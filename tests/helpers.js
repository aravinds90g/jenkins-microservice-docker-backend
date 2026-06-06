const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-1234';

function generateToken(payload = {}, expiresIn = '1h') {
  return jwt.sign(
    { id: '64b8e6f1c9a4b5d2e3f4a5b6', email: 'test@void.tech', role: 'user', ...payload },
    JWT_SECRET,
    { expiresIn }
  );
}

function adminToken(overrides = {}) {
  return generateToken({ id: '64b8e6f1c9a4b5d2e3f4a5b7', email: 'admin@void.tech', role: 'admin', ...overrides });
}

function userToken(overrides = {}) {
  return generateToken({ id: '64b8e6f1c9a4b5d2e3f4a5b6', email: 'user@void.tech', role: 'user', ...overrides });
}

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res;
}

function mockReq(overrides = {}) {
  return {
    body: {},
    params: {},
    query: {},
    headers: {},
    user: { id: '64b8e6f1c9a4b5d2e3f4a5b6', email: 'user@void.tech', role: 'user' },
    ...overrides,
  };
}

module.exports = { generateToken, adminToken, userToken, mockRes, mockReq, JWT_SECRET };
