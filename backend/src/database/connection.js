const mongoose = require('mongoose');
const config = require('@config');

async function repairUserGoogleIdIndex() {
  try {
    const users = mongoose.connection.collection('users');

    // Old sparse unique index treated googleId:null as a value → 2nd signup failed
    await users.updateMany({ googleId: null }, { $unset: { googleId: '' } });

    const indexes = await users.indexes();
    const legacy = indexes.find(
      (idx) =>
        idx.name === 'googleId_1' &&
        !idx.partialFilterExpression
    );
    if (legacy) {
      await users.dropIndex('googleId_1');
      console.info('Dropped legacy googleId unique index');
    }

    const User = require('@models/User');
    await User.syncIndexes();
  } catch (error) {
    console.warn('googleId index repair skipped:', error.message);
  }
}

const connectDatabase = async () => {
  try {
    const connection = await mongoose.connect(config.mongodbUri);
    console.info(`MongoDB connected: ${connection.connection.host}`);
    await repairUserGoogleIdIndex();
    return connection;
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    process.exit(1);
  }
};

mongoose.connection.on('disconnected', () => {
  console.warn('MongoDB disconnected');
});

mongoose.connection.on('error', (error) => {
  console.error('MongoDB error:', error.message);
});

module.exports = { connectDatabase };
