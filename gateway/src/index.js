require('dotenv').config();
const express = require('express');
const cors = require('cors');
const proxy = require('express-http-proxy');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 5000;

const USER_SERVICE = process.env.USER_SERVICE_URL || 'http://localhost:3001';
const PRODUCT_SERVICE = process.env.PRODUCT_SERVICE_URL || 'http://localhost:3002';
const CART_SERVICE = process.env.CART_SERVICE_URL || 'http://localhost:3003';
const ORDER_SERVICE = process.env.ORDER_SERVICE_URL || 'http://localhost:3004';
const PAYMENT_SERVICE = process.env.PAYMENT_SERVICE_URL || 'http://localhost:3005';

app.use(cors());

const authenticate = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  try {
    const token = header.split(' ')[1];
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

app.use('/api/users', proxy(USER_SERVICE, { proxyReqPathResolver: (req) => '/api/users' + req.url }));
app.use('/api/products', proxy(PRODUCT_SERVICE, { proxyReqPathResolver: (req) => '/api/products' + req.url }));

app.use('/api/cart', authenticate, proxy(CART_SERVICE, { proxyReqPathResolver: (req) => '/api/cart' + req.url }));
app.use('/api/payments', authenticate, proxy(PAYMENT_SERVICE, { proxyReqPathResolver: (req) => '/api/payments' + req.url }));
app.use('/api/orders', authenticate, proxy(ORDER_SERVICE, { proxyReqPathResolver: (req) => '/api/orders' + req.url }));

app.use('/api/payments/webhook/stripe', proxy(PAYMENT_SERVICE, { proxyReqPathResolver: (req) => '/api/payments/webhook/stripe' }));

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'api-gateway',
    version: require('../package.json').version,
    port: PORT,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    upstreams: {
      user: USER_SERVICE,
      product: PRODUCT_SERVICE,
      cart: CART_SERVICE,
      order: ORDER_SERVICE,
      payment: PAYMENT_SERVICE,
    },
    memory: process.memoryUsage(),
  });
});

if (require.main === module) {
  app.listen(PORT, () => console.log(`API Gateway running on port ${PORT}`));
}

module.exports = app;
