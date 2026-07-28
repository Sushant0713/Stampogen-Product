const config = require('@config');
const { COOKIE_NAMES } = require('@constants');
const { getAccessTokenMaxAge, getRefreshTokenMaxAge } = require('@utils/token');

const getCookieOptions = (maxAge) => ({
  httpOnly: config.cookie.httpOnly,
  secure: config.cookie.secure,
  sameSite: config.cookie.sameSite,
  maxAge,
  path: '/',
});

const setAuthCookies = (res, accessToken, refreshToken) => {
  res.cookie(COOKIE_NAMES.ACCESS_TOKEN, accessToken, getCookieOptions(getAccessTokenMaxAge()));
  res.cookie(COOKIE_NAMES.REFRESH_TOKEN, refreshToken, getCookieOptions(getRefreshTokenMaxAge()));
};

const clearAuthCookies = (res) => {
  const options = {
    httpOnly: config.cookie.httpOnly,
    secure: config.cookie.secure,
    sameSite: config.cookie.sameSite,
    path: '/',
  };

  res.clearCookie(COOKIE_NAMES.ACCESS_TOKEN, options);
  res.clearCookie(COOKIE_NAMES.REFRESH_TOKEN, options);
};

module.exports = {
  setAuthCookies,
  clearAuthCookies,
  getCookieOptions,
};
