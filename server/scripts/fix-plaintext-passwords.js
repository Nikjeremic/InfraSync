const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

// Heuristic: bcrypt hashes typically start with $2a$, $2b$, or $2y$ and are ~60 chars
function looksLikeBcrypt(hash) {
  if (typeof hash !== 'string') return false;
  if (hash.length < 55 || hash.length > 100) return false;
  return hash.startsWith('$2a$') || hash.startsWith('$2b$') || hash.startsWith('$2y$');
}

async function run() {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/infrasync';

  await mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const users = await User.find({}, '+password').session(session);

    let updatedCount = 0;
    for (const user of users) {
      const current = user.password;
      if (!looksLikeBcrypt(current)) {
        const salt = await bcrypt.genSalt(12);
        const hashed = await bcrypt.hash(current, salt);
        user.password = hashed;
        await user.save({ session });
        updatedCount += 1;
        console.log(`Hashed password for user ${user.email}`);
      }
    }

    await session.commitTransaction();
    console.log(`Done. Updated ${updatedCount} user(s).`);
  } catch (err) {
    console.error('Error during password fix:', err);
    await session.abortTransaction();
    process.exitCode = 1;
  } finally {
    session.endSession();
    await mongoose.disconnect();
  }
}

run(); 