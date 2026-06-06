const jwt = require('jsonwebtoken');
const { authenticate, adminOnly } = require('../shared/middleware/auth');
const { mockReq, mockRes, generateToken, JWT_SECRET } = require('./helpers');

describe('shared/middleware/auth', () => {
  describe('authenticate', () => {
    test('returns 401 when Authorization header is missing', () => {
      const req = mockReq({ headers: {} });
      const res = mockRes();
      const next = jest.fn();
      authenticate(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'No token provided' });
      expect(next).not.toHaveBeenCalled();
    });

    test('returns 401 when Authorization header does not start with Bearer', () => {
      const req = mockReq({ headers: { authorization: 'Basic xyz' } });
      const res = mockRes();
      const next = jest.fn();
      authenticate(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'No token provided' });
      expect(next).not.toHaveBeenCalled();
    });

    test('returns 401 when token is invalid', () => {
      const req = mockReq({ headers: { authorization: 'Bearer not-a-real-token' } });
      const res = mockRes();
      const next = jest.fn();
      authenticate(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid token' });
      expect(next).not.toHaveBeenCalled();
    });

    test('returns 401 when token is signed with a different secret', () => {
      const token = jwt.sign({ id: '1', role: 'user' }, 'wrong-secret', { expiresIn: '1h' });
      const req = mockReq({ headers: { authorization: `Bearer ${token}` } });
      const res = mockRes();
      const next = jest.fn();
      authenticate(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid token' });
    });

    test('returns 401 when token is expired', () => {
      const token = jwt.sign({ id: '1', role: 'user' }, JWT_SECRET, { expiresIn: '-1s' });
      const req = mockReq({ headers: { authorization: `Bearer ${token}` } });
      const res = mockRes();
      const next = jest.fn();
      authenticate(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid token' });
    });

    test('sets req.user and calls next() for a valid token', () => {
      const token = generateToken({ id: 'abc', role: 'admin' });
      const req = mockReq({ headers: { authorization: `Bearer ${token}` } });
      const res = mockRes();
      const next = jest.fn();
      authenticate(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
      expect(req.user).toBeDefined();
      expect(req.user.id).toBe('abc');
      expect(req.user.role).toBe('admin');
    });
  });

  describe('adminOnly', () => {
    test('returns 403 when req.user is missing', () => {
      const req = mockReq();
      delete req.user;
      const res = mockRes();
      const next = jest.fn();
      adminOnly(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Admin access required' });
      expect(next).not.toHaveBeenCalled();
    });

    test('returns 403 when role is not admin', () => {
      const req = mockReq({ user: { id: '1', role: 'user' } });
      const res = mockRes();
      const next = jest.fn();
      adminOnly(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Admin access required' });
      expect(next).not.toHaveBeenCalled();
    });

    test('calls next() for admin user', () => {
      const req = mockReq({ user: { id: '1', role: 'admin' } });
      const res = mockRes();
      const next = jest.fn();
      adminOnly(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});
