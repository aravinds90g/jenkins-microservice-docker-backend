require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const productRoutes = require('./routes/products');

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(express.json());

app.use('/api/products', productRoutes);

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'product-service',
    version: require('../package.json').version,
    port: PORT,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    memory: process.memoryUsage(),
  });
});

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('Product Service: connected to MongoDB');
    app.listen(PORT, () => console.log(`Product Service running on port ${PORT}`));
  })
  .catch((err) => {
    console.error('Product Service DB connection error:', err);
    process.exit(1);
  });
