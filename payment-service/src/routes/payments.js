const { Router } = require('express');
const { authenticate } = require('../../../shared/middleware/auth');
const { createIntent, getStatus } = require('../controllers/paymentController');

const router = Router();

router.post('/create-intent', authenticate, createIntent);
router.get('/status/:orderId', authenticate, getStatus);

module.exports = router;
