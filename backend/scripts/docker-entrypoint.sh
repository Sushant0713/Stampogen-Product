#!/bin/sh
set -e

echo "Waiting for MongoDB..."
ATTEMPTS=0
MAX_ATTEMPTS=60
until node -e "
const mongoose = require('mongoose');
mongoose.connect(process.env.MONGODB_URI || 'mongodb://mongo:27017/stampogen', {
  serverSelectionTimeoutMS: 2000,
}).then(() => mongoose.disconnect()).then(() => process.exit(0))
  .catch(() => process.exit(1));
" 2>/dev/null; do
  ATTEMPTS=$((ATTEMPTS + 1))
  if [ "$ATTEMPTS" -ge "$MAX_ATTEMPTS" ]; then
    echo "MongoDB not reachable after ${MAX_ATTEMPTS} attempts"
    exit 1
  fi
  sleep 2
done

echo "MongoDB is up — seeding roles..."
node src/database/seed.js || true

echo "Starting API..."
exec "$@"
