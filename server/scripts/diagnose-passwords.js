const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const User = require('../models/User');

function looksLikeBcrypt(hash) {
  if (typeof hash !== 'string') return false;
  return (hash.startsWith('$2') && hash.length >= 55);
}

async function run() {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/infrasync';
  await mongoose.connect(mongoUri);
  try {
    const users = await User.find({}, 'email password isActive role');
    users.forEach(u => {
      const state = looksLikeBcrypt(u.password) ? 'bcrypt' : 'PLAINTEXT_OR_UNKNOWN';
      console.log(`${u.email} | ${state} | active=${u.isActive} | role=${u.role}`);
    });
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}
run(); 