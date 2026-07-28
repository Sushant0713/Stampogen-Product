const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const config = require('@config');

const UNIT_MS = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
};

const parseExpiresInMs = (expiresIn, fallbackMs = 365 * 24 * 60 * 60 * 1000) => {
  if (typeof expiresIn === 'number') {
    return expiresIn * 1000;
  }

  const match = String(expiresIn).match(/^(\d+)([dhms])$/);
  if (!match) {
    return fallbackMs;
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];
  return value * UNIT_MS[unit];
};

const generateAccessToken = (payload) => {
  return jwt.sign(payload, config.jwt.accessSecret, {
    expiresIn: config.jwt.accessExpiresIn,
  });
};

const generateRefreshToken = (payload) => {
  return jwt.sign(payload, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiresIn,
  });
};

const verifyAccessToken = (token) => {
  return jwt.verify(token, config.jwt.accessSecret);
};

const verifyRefreshToken = (token) => {
  return jwt.verify(token, config.jwt.refreshSecret);
};

const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

const getRefreshTokenExpiry = () => {
  return new Date(Date.now() + parseExpiresInMs(config.jwt.refreshExpiresIn));
};

const getAccessTokenMaxAge = () => parseExpiresInMs(config.jwt.accessExpiresIn);
const getRefreshTokenMaxAge = () => parseExpiresInMs(config.jwt.refreshExpiresIn);

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  hashToken,
  getRefreshTokenExpiry,
  parseExpiresInMs,
  getAccessTokenMaxAge,
  getRefreshTokenMaxAge,
};
