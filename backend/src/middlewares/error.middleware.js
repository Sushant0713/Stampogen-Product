const AppError = require('@utils/AppError');
const { HTTP_STATUS } = require('@constants');
const config = require('@config');

const notFoundHandler = (req, _res, next) => {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, HTTP_STATUS.NOT_FOUND));
};

const errorHandler = (err, _req, res, _next) => {
  let statusCode = err.statusCode || HTTP_STATUS.INTERNAL_SERVER;
  let message = err.message || 'Internal server error';
  let errors = err.errors || null;

  if (err.name === 'ValidationError') {
    statusCode = HTTP_STATUS.UNPROCESSABLE;
    message = 'Validation failed';
    errors = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
  }

  if (err.code === 11000) {
    statusCode = HTTP_STATUS.CONFLICT;
    const field = Object.keys(err.keyPattern || {})[0] || 'field';
    if (field === 'email') {
      message = 'Email already registered';
    } else if (field === 'googleId') {
      message = 'This Google account is already linked to another user';
    } else if (field === 'slug') {
      message = 'Business name already taken';
    } else if (field === 'code') {
      message = 'Code already exists';
    } else {
      message = `${field} already exists`;
    }
  }

  if (err.name === 'CastError') {
    statusCode = HTTP_STATUS.BAD_REQUEST;
    message = 'Invalid resource identifier';
  }

  if (err.name === 'JsonWebTokenError') {
    statusCode = HTTP_STATUS.UNAUTHORIZED;
    message = 'Invalid token';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = HTTP_STATUS.UNAUTHORIZED;
    message = 'Token expired';
  }

  if (config.env === 'development' && !err.isOperational) {
    console.error(err);
  }

  return res.status(statusCode).json({
    success: false,
    message,
    ...(err.code && typeof err.code === 'string' && { code: err.code }),
    ...(err.email && { email: err.email }),
    ...(errors && { errors }),
    ...(config.env === 'development' && !err.isOperational && { stack: err.stack }),
  });
};

module.exports = {
  notFoundHandler,
  errorHandler,
};
