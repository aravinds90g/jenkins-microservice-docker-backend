require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

async function connectWithRetry(retries = 15, delayMs = 2000) {
  for (let i = 1; i <= retries; i++) {
    try {
      await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 3000 });
      return;
    } catch (err) {
      console.log(`[seed] mongo not ready, retry ${i}/${retries}...`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw new Error('[seed] could not connect to MongoDB');
}

async function seed() {
  try {
    await connectWithRetry();

    const existing = await User.countDocuments();
    if (existing > 0) {
      console.log(`[seed] users collection has ${existing} docs, skipping`);
      process.exit(0);
    }

    const admin = await User.create({
      name: 'Admin Void',
      email: 'admin@void.tech',
      password: 'admin123',
      role: 'admin',
      phone: '+91 99999 88888',
      address: 'Void Tower, Node-4, Bengaluru',
    });
    const user = await User.create({
      name: 'Aravind S',
      email: 'aravind@void.tech',
      password: 'user123',
      role: 'user',
      phone: '+91 98765 43210',
      address: 'Void Tower, Penthouse 404, Cybercity, Bengaluru 560001',
    });
    console.log(`[seed] inserted admin: ${admin.email} / admin123`);
    console.log(`[seed] inserted user: ${user.email} / user123`);
    process.exit(0);
  } catch (err) {
    console.error('[seed] error:', err);
    process.exit(1);
  }
}

seed();
