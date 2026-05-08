'use strict';

const express = require('express');
const router = express.Router();

const {
  getAllTransactions,
  getTransaction,
  getLatestBalance,
  createTransaction,
  updateTransaction,
  deleteTransaction,
} = require('../controllers/transactionController');

const { protect, restrictTo } = require('../middlewares/auth');
const { transactionValidator, mongoIdValidator, paginationValidator } = require('../middlewares/validators');

// All transaction routes require authentication
router.use(protect);

// Must be before /:id to avoid matching 'latest-balance' as an id
router.get('/latest-balance', getLatestBalance);

router.get('/', paginationValidator, getAllTransactions);
router.get('/:id', mongoIdValidator, getTransaction);
router.post('/', transactionValidator, createTransaction);
router.put('/:id', mongoIdValidator, transactionValidator, updateTransaction);

// All authenticated admins can delete transactions
router.delete('/:id', mongoIdValidator, deleteTransaction);

module.exports = router;
