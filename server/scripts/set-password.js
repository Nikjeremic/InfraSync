const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const User = require('../models/User');

async function run() {
  const [,, emailArg, passwordArg] = process.argv;
  if (!emailArg || !passwordArg) {
    console.error('Usage: node scripts/set-password.js <email> <newPassword>');
    process.exit(1);
  }

  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/infrasync';
  await mongoose.connect(mongoUri);

  try {
    const user = await User.findOne({ email: emailArg });
    if (!user) {
      console.error(`User not found: ${emailArg}`);
      process.exit(1);
    }

    user.password = passwordArg; // will be hashed by pre-save hook
    await user.save();
    console.log(`Password updated for ${emailArg}`);
  } catch (err) {
    console.error('Error setting password:', err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

run(); 