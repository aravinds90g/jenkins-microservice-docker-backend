require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { connectRabbitMQ } = require('../../shared/rabbitmq');
const { startOrderConsumer } = require('./consumers/orderConsumer');
const paymentRoutes = require('./routes/payments');
const { handleWebhook } = require('./controllers/paymentController');

const app = express();
const PORT = process.env.PORT || 3005;

app.use(cors());

app.post('/api/payments/webhook/stripe', express.raw({ type: 'application/json' }), handleWebhook);

app.use(express.json());

app.use('/api/payments', paymentRoutes);

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'payment-service',
    version: require('../package.json').version,
    port: PORT,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    memory: process.memoryUsage(),
  });
});

Promise.all([
  mongoose.connect(process.env.MONGO_URI),
  connectRabbitMQ().catch((err) => {
    console.error('RabbitMQ connection failed (non-fatal):', err.message);
  }),
]).then(() => {
  console.log('Payment Service: connected to MongoDB');
  startOrderConsumer();
  app.listen(PORT, () => console.log(`Payment Service running on port ${PORT}`));
}).catch((err) => {
  console.error('Payment Service startup error:', err);
  process.exit(1);
});
