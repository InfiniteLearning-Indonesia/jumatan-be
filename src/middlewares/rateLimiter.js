'use strict';

const rateLimit = require('express-rate-limit');

const createLimiter = (windowMs, max, message) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message },
    skip: (req) => process.env.NODE_ENV === 'test',
  });

/** 5 attempts per 15 minutes for auth endpoints */
const authLimiter = createLimiter(
  15 * 60 * 1000,
  5,
  'Too many login attempts. Please try again in 15 minutes.'
);

/** 100 requests per minute for general API */
const apiLimiter = createLimiter(
  60 * 1000,
  100,
  'Too many requests. Please slow down.'
);

module.exports = { authLimiter, apiLimiter };
