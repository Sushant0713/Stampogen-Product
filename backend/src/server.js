require('./config/aliases');

const config = require('@config');
const { connectDatabase } = require('@database/connection');
const createApp = require('./app');

const startServer = async () => {
  await connectDatabase();

  const app = createApp();

  const server = app.listen(config.port, () => {
    console.info(`Server running in ${config.env} mode on port ${config.port}`);
    console.info(`Google OAuth callback URL: ${config.google.callbackUrl}`);
  });

  const shutdown = (signal) => {
    console.info(`${signal} received. Shutting down gracefully...`);
    server.close(() => {
      console.info('HTTP server closed');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    console.error('Unhandled Rejection:', reason);
  });

  process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
  });
};

startServer();
