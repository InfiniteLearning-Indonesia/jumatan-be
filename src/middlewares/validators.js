'use strict';

const { validationResult, body, param, query } = require('express-validator');

/**
 * Run after validator chain — returns 400 if any errors exist.
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }
  next();
};

// ─── Auth validators ────────────────────────────────────────────────────────

const loginValidator = [
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
  validate,
];

const registerValidator = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/\d/)
    .withMessage('Password must contain at least one number'),
  body('role')
    .optional()
    .isIn(['admin', 'superadmin'])
    .withMessage('Role must be admin or superadmin'),
  validate,
];

const changePasswordValidator = [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters')
    .matches(/\d/)
    .withMessage('New password must contain at least one number'),
  validate,
];

// ─── Transaction validators ──────────────────────────────────────────────────

const transactionValidator = [
  body('date').isISO8601().withMessage('Date must be a valid ISO 8601 date'),
  body('isFridayHeld')
    .optional()
    .isBoolean()
    .withMessage('isFridayHeld must be boolean'),
  body('skippedReason')
    .optional({ nullable: true })
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Skipped reason must be at most 500 characters'),
  body('infakQris')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Infak QRIS must be a non-negative number'),
  body('infakTunai')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Infak tunai must be a non-negative number'),
  // totalInfak, saldoAwal, saldoAkhir, saldoTotalQrisTunai are now auto-computed by backend
  body('otherCurrencies')
    .optional()
    .isArray()
    .withMessage('otherCurrencies must be an array'),
  body('otherCurrencies.*.currency')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 10 })
    .withMessage('Currency code must be at most 10 characters'),
  body('otherCurrencies.*.amount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Currency amount must be a non-negative number'),
  body('notes')
    .optional({ nullable: true })
    .isString()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Notes must be at most 1000 characters'),
  validate,
];

// ─── Expense / Income validators ─────────────────────────────────────────────

const financialEntryValidator = [
  body('date').isISO8601().withMessage('Date must be a valid ISO 8601 date'),
  body('category')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Category is required and must be at most 100 characters'),
  body('description')
    .trim()
    .isLength({ min: 1, max: 500 })
    .withMessage('Description is required and must be at most 500 characters'),
  body('amountQris')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('QRIS amount must be a non-negative number'),
  body('amountTunai')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Tunai amount must be a non-negative number'),
  body('currency')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 10 })
    .withMessage('Currency must be at most 10 characters'),
  body('notes')
    .optional({ nullable: true })
    .isString()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Notes must be at most 1000 characters'),
  validate,
];

// ─── Common ──────────────────────────────────────────────────────────────────

const mongoIdValidator = [
  param('id').isMongoId().withMessage('Invalid ID format'),
  validate,
];

const paginationValidator = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  validate,
];

module.exports = {
  validate,
  loginValidator,
  registerValidator,
  changePasswordValidator,
  transactionValidator,
  financialEntryValidator,
  mongoIdValidator,
  paginationValidator,
};
