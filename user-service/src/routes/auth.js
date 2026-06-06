const { Router } = require('express');
const { authenticate, adminOnly } = require('../../../shared/middleware/auth');
const {
  register, login, getProfile, updateProfile,
  listUsers, getUser, updateUser, deleteUser,
} = require('../controllers/authController');

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/profile', authenticate, getProfile);
router.patch('/profile', authenticate, updateProfile);

router.get('/', authenticate, adminOnly, listUsers);
router.get('/:id', authenticate, adminOnly, getUser);
router.patch('/:id', authenticate, adminOnly, updateUser);
router.delete('/:id', authenticate, adminOnly, deleteUser);

module.exports = router;
