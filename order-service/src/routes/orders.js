const { Router } = require('express');
const { authenticate, adminOnly } = require('../../../shared/middleware/auth');
const { createOrder, listOrders, getOrder, updateStatus, getAllOrders } = require('../controllers/orderController');

const router = Router();

router.post('/', authenticate, createOrder);
router.get('/', authenticate, listOrders);
router.get('/all', authenticate, adminOnly, getAllOrders);
router.get('/:id', authenticate, getOrder);
router.patch('/:id/status', authenticate, adminOnly, updateStatus);

module.exports = router;
