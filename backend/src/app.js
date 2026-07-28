require('./config/aliases');

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const passport = require('passport');
const config = require('@config');
const { configurePassport } = require('@config/passport');
const { globalLimiter } = require('@middlewares/rateLimit.middleware');
const { notFoundHandler, errorHandler } = require('@middlewares/error.middleware');
const routes = require('@/routes');

const createApp = () => {
  const app = express();

  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(
    cors({
      origin: config.corsOrigin,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    })
  );
  app.use(express.json({ limit: '12mb' }));
  app.use(express.urlencoded({ extended: true, limit: '12mb' }));
  app.use(cookieParser());
  app.use(morgan(config.env === 'production' ? 'combined' : 'dev'));
  app.use(globalLimiter);

  configurePassport();
  app.use(passport.initialize());

  app.use('/api/v1', routes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};

module.exports = createApp;
