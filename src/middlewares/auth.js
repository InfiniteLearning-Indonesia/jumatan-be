'use strict';

const jwt = require('jsonwebtoken');
const { User } = require('../models/User');

/**
 * Protect routes – verifies JWT from Authorization header.
 */
const protect = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.',
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      const message =
        err.name === 'TokenExpiredError'
          ? 'Token has expired. Please log in again.'
          : 'Invalid token. Please log in again.';
      return res.status(401).json({ success: false, message });
    }

    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User belonging to this token no longer exists.',
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Your account has been deactivated. Contact superadmin.',
      });
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
};

/**
 * Restrict access to specific roles.
 * Usage: restrictTo('superadmin')
 */
const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to perform this action.',
      });
    }
    next();
  };
};

module.exports = { protect, restrictTo };
