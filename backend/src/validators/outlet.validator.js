const { body } = require('express-validator');

const createOutletValidator = [
  body('name').trim().notEmpty().withMessage('Outlet name is required'),
  body('email').trim().isEmail().withMessage('Valid outlet login email is required'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters'),
  body('firstName').optional().trim().isLength({ max: 50 }),
  body('lastName').optional().trim().isLength({ max: 50 }),
  body('seatId').optional().isMongoId().withMessage('Invalid seat id'),
];

module.exports = {
  createOutletValidator,
};
