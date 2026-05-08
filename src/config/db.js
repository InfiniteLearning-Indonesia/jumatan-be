'use strict';

const mongoose = require('mongoose');

const connectDB = async () => {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.error('❌  MONGODB_URI is not defined in environment variables');
    process.exit(1);
  }

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      family: 4, // force IPv4 to avoid DNS issues
    });

    console.log(`✅  MongoDB connected: ${conn.connection.host}`);
  } catch (err) {
    console.error(`❌  MongoDB connection error: ${err.message}`);
    // Retry after 5 seconds
    setTimeout(connectDB, 5000);
  }
};

// Handle unexpected disconnection
mongoose.connection.on('disconnected', () => {
  console.warn('⚠️  MongoDB disconnected. Attempting to reconnect...');
});

mongoose.connection.on('reconnected', () => {
  console.log('✅  MongoDB reconnected');
});

module.exports = connectDB;
