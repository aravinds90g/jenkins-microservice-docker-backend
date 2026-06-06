require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { connectRabbitMQ } = require('../../shared/rabbitmq');
const orderRoutes = require('./routes/orders');

const app = express();
const PORT = process.env.PORT || 3004;

app.use(cors());
app.use(express.json());

app.use('/api/orders', orderRoutes);

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'order-service',
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
  console.log('Order Service: connected to MongoDB');
  app.listen(PORT, () => console.log(`Order Service running on port ${PORT}`));
}).catch((err) => {
  console.error('Order Service startup error:', err);
  process.exit(1);
});
