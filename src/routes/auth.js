'use strict';

const express = require('express');
const router = express.Router();

const {
  login,
  logout,
  getMe,
  changePassword,
  register,
  getAllUsers,
  toggleUserActive,
  deleteUser,
} = require('../controllers/authController');

const { protect, restrictTo } = require('../middlewares/auth');
const { authLimiter } = require('../middlewares/rateLimiter');
const {
  loginValidator,
  registerValidator,
  changePasswordValidator,
  mongoIdValidator,
} = require('../middlewares/validators');

// Public
router.post('/login', authLimiter, loginValidator, login);
router.get('/logout', logout);

// Authenticated
router.use(protect);
router.get('/me', getMe);
router.patch('/change-password', changePasswordValidator, changePassword);

// Superadmin only
router.use(restrictTo('superadmin'));
router.post('/register', registerValidator, register);
router.get('/users', getAllUsers);
router.patch('/users/:id/toggle-active', mongoIdValidator, toggleUserActive);
router.delete('/users/:id', mongoIdValidator, deleteUser);

module.exports = router;
