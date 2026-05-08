'use strict';

const jwt = require('jsonwebtoken');
const { User, ROLES } = require('../models/User');

// ─── Helpers ─────────────────────────────────────────────────────────────────

const signToken = (id) => {
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn, algorithm: 'HS256' });
};

const sendToken = (user, statusCode, res) => {
  const token = signToken(user._id);

  const isDev = process.env.NODE_ENV === 'development';
  // Send as HttpOnly cookie
  res.cookie('token', token, {
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    httpOnly: true,
    secure: !isDev,
    sameSite: !isDev ? 'none' : 'lax',
  });
  res.status(statusCode).json({
    success: true,
    token,
    data: { user },
  });
};

// ─── Controllers ─────────────────────────────────────────────────────────────

/**
 * POST /api/auth/login
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Explicitly select password since it's hidden by default
    const user = await User.findOne({ email }).select('+password');

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Your account has been deactivated. Contact superadmin.',
      });
    }

    // Update last login timestamp
    await User.findByIdAndUpdate(user._id, { lastLoginAt: new Date() });

    sendToken(user, 200, res);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/auth/logout
 */
const logout = async (req, res, next) => {
  const isDev = process.env.NODE_ENV === 'development';
  res.cookie('token', 'loggedout', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
    secure: !isDev,
    sameSite: !isDev ? 'none' : 'lax',
  });
  res.status(200).json({ success: true, message: 'Logged out successfully' });
};

/**
 * GET /api/auth/me
 */
const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    res.json({ success: true, data: { user } });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/auth/change-password
 */
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user._id).select('+password');

    if (!(await user.comparePassword(currentPassword))) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect.',
      });
    }

    user.password = newPassword;
    await user.save();

    sendToken(user, 200, res);
  } catch (err) {
    next(err);
  }
};

// ─── User management (superadmin only) ───────────────────────────────────────

/**
 * POST /api/auth/register  (superadmin only)
 */
const register = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;

    // Only superadmin can create another superadmin
    if (role === ROLES.SUPERADMIN && req.user.role !== ROLES.SUPERADMIN) {
      return res.status(403).json({
        success: false,
        message: 'Only superadmins can create superadmin accounts.',
      });
    }

    const user = await User.create({
      name,
      email,
      password,
      role: role || ROLES.ADMIN,
      createdBy: req.user._id,
    });

    res.status(201).json({ success: true, data: { user } });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/auth/users  (superadmin only)
 */
const getAllUsers = async (req, res, next) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.json({ success: true, data: { users } });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/auth/users/:id/toggle-active  (superadmin only)
 */
const toggleUserActive = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    // Prevent superadmin from deactivating themselves
    if (user._id.equals(req.user._id)) {
      return res.status(400).json({
        success: false,
        message: 'You cannot deactivate your own account.',
      });
    }

    user.isActive = !user.isActive;
    await user.save();

    res.json({
      success: true,
      message: `User ${user.isActive ? 'activated' : 'deactivated'} successfully.`,
      data: { user },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/auth/users/:id  (superadmin only)
 */
const deleteUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    if (user._id.equals(req.user._id)) {
      return res.status(400).json({
        success: false,
        message: 'You cannot delete your own account.',
      });
    }

    await User.findByIdAndDelete(req.params.id);

    res.json({ success: true, message: 'User deleted successfully.' });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  login,
  logout,
  getMe,
  changePassword,
  register,
  getAllUsers,
  toggleUserActive,
  deleteUser,
};
