const { validationResult } = require('express-validator');
const AppError = require('@utils/AppError');
const { HTTP_STATUS } = require('@constants');

const validate = (req, _res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const formatted = errors.array().map((err) => ({
      field: err.path,
      message: err.msg,
    }));

    return next(new AppError('Validation failed', HTTP_STATUS.UNPROCESSABLE, formatted));
  }

  return next();
};

module.exports = validate;
