// Mock the User model so we can test controller logic without a real DB.
jest.mock('../user-service/src/models/User');
const User = require('../user-service/src/models/User');
const {
  register, login, getProfile, updateProfile,
  listUsers, getUser, updateUser, deleteUser,
} = require('../user-service/src/controllers/authController');
const { mockReq, mockRes } = require('./helpers');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('user-service authController', () => {
  describe('register', () => {
    test('returns 400 when name, email, or password is missing', async () => {
      const res = mockRes();
      await register(mockReq({ body: { name: 'A' } }), res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Name, email, and password are required' });
    });

    test('returns 409 when email already exists', async () => {
      User.findOne = jest.fn().mockResolvedValue({ _id: 'x', email: 'a@b.com' });
      const res = mockRes();
      await register(mockReq({ body: { name: 'A', email: 'a@b.com', password: 'pwd123' } }), res);
      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({ error: 'Email already registered' });
    });

    test('creates user and returns 201 with token', async () => {
      User.findOne = jest.fn().mockResolvedValue(null);
      const created = { _id: 'new-id', name: 'A', email: 'a@b.com', role: 'user' };
      User.create = jest.fn().mockResolvedValue(created);
      const res = mockRes();
      await register(mockReq({ body: { name: 'A', email: 'a@b.com', password: 'pwd123' } }), res);
      expect(User.create).toHaveBeenCalledWith({ name: 'A', email: 'a@b.com', password: 'pwd123' });
      expect(res.status).toHaveBeenCalledWith(201);
      const payload = res.json.mock.calls[0][0];
      expect(payload.token).toBeDefined();
      expect(payload.token.split('.').length).toBe(3); // valid JWT
      expect(payload.user).toEqual(created);
    });
  });

  describe('login', () => {
    test('returns 400 when email or password missing', async () => {
      const res = mockRes();
      await login(mockReq({ body: { email: 'a@b.com' } }), res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Email and password are required' });
    });

    test('returns 401 when user not found', async () => {
      User.findOne = jest.fn().mockResolvedValue(null);
      const res = mockRes();
      await login(mockReq({ body: { email: 'a@b.com', password: 'pwd123' } }), res);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid email or password' });
    });

    test('returns 401 when password is wrong', async () => {
      User.findOne = jest.fn().mockResolvedValue({
        _id: '1', email: 'a@b.com', role: 'user',
        comparePassword: jest.fn().mockResolvedValue(false),
      });
      const res = mockRes();
      await login(mockReq({ body: { email: 'a@b.com', password: 'wrong' } }), res);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    test('returns 200 with token and user on successful login', async () => {
      const user = { _id: '1', email: 'a@b.com', role: 'user', comparePassword: jest.fn().mockResolvedValue(true) };
      User.findOne = jest.fn().mockResolvedValue(user);
      const res = mockRes();
      await login(mockReq({ body: { email: 'a@b.com', password: 'pwd123' } }), res);
      expect(res.json).toHaveBeenCalled();
      const payload = res.json.mock.calls[0][0];
      expect(payload.token).toBeDefined();
      expect(payload.user).toEqual(user);
    });
  });

  describe('getProfile', () => {
    test('returns 404 if user not found', async () => {
      User.findById = jest.fn().mockResolvedValue(null);
      const res = mockRes();
      await getProfile(mockReq({ user: { id: '1' } }), res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    test('returns user when found', async () => {
      const user = { _id: '1', name: 'A', email: 'a@b.com', role: 'user' };
      User.findById = jest.fn().mockResolvedValue(user);
      const res = mockRes();
      await getProfile(mockReq({ user: { id: '1' } }), res);
      expect(res.json).toHaveBeenCalledWith({ user });
    });
  });

  describe('updateProfile', () => {
    test('updates only name, phone, address fields (whitelisted)', async () => {
      const updated = { _id: '1', name: 'NewName', role: 'admin', phone: '+91', address: 'addr' };
      User.findByIdAndUpdate = jest.fn().mockResolvedValue(updated);
      const res = mockRes();
      // Attempt to also set role — should be filtered out
      await updateProfile(mockReq({
        user: { id: '1' },
        body: { name: 'NewName', role: 'admin', password: 'hax' },
      }), res);
      const args = User.findByIdAndUpdate.mock.calls[0];
      expect(args[0]).toBe('1');
      expect(args[1]).toEqual({ name: 'NewName' });
      expect(args[1].role).toBeUndefined();
      expect(args[1].password).toBeUndefined();
      expect(res.json).toHaveBeenCalledWith({ user: updated });
    });

    test('returns 404 if user not found', async () => {
      User.findByIdAndUpdate = jest.fn().mockResolvedValue(null);
      const res = mockRes();
      await updateProfile(mockReq({ user: { id: '1' }, body: { name: 'X' } }), res);
      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('listUsers (admin)', () => {
    test('returns user list sorted by createdAt desc', async () => {
      const users = [{ _id: '1' }, { _id: '2' }];
      User.find = jest.fn().mockReturnValue({ sort: jest.fn().mockResolvedValue(users) });
      const res = mockRes();
      await listUsers(mockReq(), res);
      expect(User.find).toHaveBeenCalledWith();
      expect(res.json).toHaveBeenCalledWith({ users });
    });
  });

  describe('getUser (admin)', () => {
    test('returns 404 if user not found', async () => {
      User.findById = jest.fn().mockResolvedValue(null);
      const res = mockRes();
      await getUser(mockReq({ params: { id: 'x' } }), res);
      expect(res.status).toHaveBeenCalledWith(404);
    });

    test('returns user when found', async () => {
      const user = { _id: 'x', name: 'X' };
      User.findById = jest.fn().mockResolvedValue(user);
      const res = mockRes();
      await getUser(mockReq({ params: { id: 'x' } }), res);
      expect(res.json).toHaveBeenCalledWith({ user });
    });
  });

  describe('updateUser (admin)', () => {
    test('updates whitelisted fields only', async () => {
      const updated = { _id: '1', role: 'admin', name: 'N' };
      User.findByIdAndUpdate = jest.fn().mockResolvedValue(updated);
      const res = mockRes();
      await updateUser(mockReq({
        params: { id: '1' },
        body: { name: 'N', role: 'admin', password: 'x' },
      }), res);
      const args = User.findByIdAndUpdate.mock.calls[0];
      expect(args[1]).toEqual({ name: 'N', role: 'admin' });
      expect(args[1].password).toBeUndefined();
      expect(res.json).toHaveBeenCalledWith({ user: updated });
    });
  });

  describe('deleteUser (admin)', () => {
    test('deletes and returns message', async () => {
      User.findByIdAndDelete = jest.fn().mockResolvedValue({ _id: '1' });
      const res = mockRes();
      await deleteUser(mockReq({ params: { id: '1' } }), res);
      expect(res.json).toHaveBeenCalledWith({ message: 'User deleted' });
    });

    test('returns 404 if user not found', async () => {
      User.findByIdAndDelete = jest.fn().mockResolvedValue(null);
      const res = mockRes();
      await deleteUser(mockReq({ params: { id: 'x' } }), res);
      expect(res.status).toHaveBeenCalledWith(404);
    });
  });
});
