'use strict';

/**
 * Seed script — creates the initial superadmin account.
 * Run: npm run seed
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const { User, ROLES } = require('../models/User');

const seed = async () => {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('❌  MONGODB_URI is not defined');
    process.exit(1);
  }

  try {
    await mongoose.connect(uri, { family: 4, serverSelectionTimeoutMS: 10000 });
    console.log('✅  Connected to MongoDB');

    const email = process.env.ADMIN_EMAIL || 'admin@kasjumatan.com';
    const existing = await User.findOne({ email });

    if (existing) {
      console.log(`ℹ️   Superadmin already exists: ${email}`);
    } else {
      await User.create({
        name: process.env.ADMIN_NAME || 'Admin',
        email,
        password: process.env.ADMIN_PASSWORD || 'admin123456',
        role: ROLES.SUPERADMIN,
      });
      console.log(`✅  Superadmin created: ${email}`);
    }
  } catch (err) {
    console.error('❌  Seed failed:', err.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('🔌  Disconnected from MongoDB');
  }
};

seed();
