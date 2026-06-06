const { Router } = require('express');
const { authenticate } = require('../../../shared/middleware/auth');
const { getCart, addItem, removeItem, updateItemQuantity, clearCart } = require('../controllers/cartController');

const router = Router();

router.get('/', authenticate, getCart);
router.post('/items', authenticate, addItem);
router.patch('/items/:productId', authenticate, updateItemQuantity);
router.delete('/items/:productId', authenticate, removeItem);
router.delete('/', authenticate, clearCart);

module.exports = router;
