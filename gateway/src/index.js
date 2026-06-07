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

app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Void Tech E-Commerce API</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: linear-gradient(135deg, #0f0c29, #302b63, #24243e); color: #fff; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
    .container { text-align: center; padding: 2rem; }
    h1 { font-size: 3rem; margin-bottom: 0.5rem; background: linear-gradient(90deg, #00d2ff, #3a7bd5); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .subtitle { font-size: 1.2rem; color: #aaa; margin-bottom: 2rem; }
    .status { display: inline-block; padding: 0.5rem 1.5rem; border-radius: 50px; background: rgba(0, 210, 255, 0.1); border: 1px solid rgba(0, 210, 255, 0.3); font-size: 0.9rem; color: #00d2ff; }
    .endpoints { margin-top: 2rem; display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem; max-width: 600px; margin-left: auto; margin-right: auto; }
    .card { background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; padding: 1.5rem; text-align: left; backdrop-filter: blur(10px); }
    .card h3 { font-size: 1rem; margin-bottom: 0.5rem; color: #00d2ff; }
    .card p { font-size: 0.85rem; color: #888; }
    .card code { display: block; margin-top: 0.5rem; font-size: 0.8rem; color: #3a7bd5; background: rgba(0,0,0,0.3); padding: 0.3rem 0.6rem; border-radius: 6px; }
    footer { margin-top: 3rem; font-size: 0.8rem; color: #555; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Void Tech</h1>
    <p class="subtitle">E-Commerce Backend API</p>
    <div class="status">Gateway is running</div>
    <div class="endpoints">
      <div class="card"><h3>Users</h3><p>Authentication &amp; user management</p><code>/api/users</code></div>
      <div class="card"><h3>Products</h3><p>Product catalog &amp; inventory</p><code>/api/products</code></div>
      <div class="card"><h3>Cart</h3><p>Shopping cart management</p><code>/api/cart</code></div>
      <div class="card"><h3>Orders</h3><p>Order processing &amp; history</p><code>/api/orders</code></div>
      <div class="card"><h3>Payments</h3><p>Payment intent &amp; webhooks</p><code>/api/payments</code></div>
    </div>
    <footer>Void Tech E-Commerce &copy; 2026</footer>
  </div>
</body>
</html>`);
});

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
