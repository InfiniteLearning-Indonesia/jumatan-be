'use strict';

const Transaction = require('../models/Transaction');
const Expense = require('../models/Expense');
const Income = require('../models/Income');

// ─── Helpers ─────────────────────────────────────────────────────────────────

const getPaginationOptions = (req) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
};

// ─── Controllers ─────────────────────────────────────────────────────────────

/**
 * GET /api/transactions
 * Query params: page, limit, startDate, endDate, isFridayHeld
 */
const getAllTransactions = async (req, res, next) => {
  try {
    const { page, limit, skip } = getPaginationOptions(req);

    const filter = {};

    if (req.query.startDate || req.query.endDate) {
      filter.date = {};
      if (req.query.startDate) filter.date.$gte = new Date(req.query.startDate);
      if (req.query.endDate) filter.date.$lte = new Date(req.query.endDate);
    }

    if (req.query.isFridayHeld !== undefined) {
      filter.isFridayHeld = req.query.isFridayHeld === 'true';
    }

    const [transactions, total] = await Promise.all([
      Transaction.find(filter)
        .sort({ date: -1 })
        .skip(skip)
        .limit(limit)
        .populate('createdBy', 'name email')
        .populate('updatedBy', 'name email'),
      Transaction.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: {
        transactions,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/transactions/:id
 */
const getTransaction = async (req, res, next) => {
  try {
    const transaction = await Transaction.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');

    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Transaction not found.' });
    }

    res.json({ success: true, data: { transaction } });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/transactions/latest-balance
 * Returns the latest transaction's ending balances so the frontend
 * can auto-fill saldo fields for a new transaction.
 */
const getLatestBalance = async (req, res, next) => {
  try {
    const [globalInfakStats, globalExpStats, globalIncStats] = await Promise.all([
      Transaction.aggregate([{ $match: { isFridayHeld: true } }, { $group: { _id: null, qris: { $sum: '$infakQris' }, tunai: { $sum: '$infakTunai' } } }]),
      Expense.aggregate([{ $group: { _id: null, qris: { $sum: { $ifNull: ['$amountQris', 0] } }, tunai: { $sum: { $add: [{ $ifNull: ['$amountTunai', 0] }, { $ifNull: ['$amount', 0] }] } } } }]),
      Income.aggregate([{ $group: { _id: null, qris: { $sum: { $ifNull: ['$amountQris', 0] } }, tunai: { $sum: { $add: [{ $ifNull: ['$amountTunai', 0] }, { $ifNull: ['$amount', 0] }] } } } }])
    ]);

    const globalInfakQris = globalInfakStats[0]?.qris || 0;
    const globalInfakTunai = globalInfakStats[0]?.tunai || 0;
    const globalExpQris = globalExpStats[0]?.qris || 0;
    const globalExpTunai = globalExpStats[0]?.tunai || 0;
    const globalIncQris = globalIncStats[0]?.qris || 0;
    const globalIncTunai = globalIncStats[0]?.tunai || 0;

    const currentGlobalQris = globalInfakQris + globalIncQris - globalExpQris;
    const currentGlobalTunai = globalInfakTunai + globalIncTunai - globalExpTunai;
    const currentGlobalSaldo = currentGlobalQris + currentGlobalTunai;

    res.json({
      success: true,
      data: {
        saldoAkhir: currentGlobalSaldo,
        saldoTotalQris: currentGlobalQris,
        saldoTotalTunai: currentGlobalTunai,
        saldoTotalQrisTunai: currentGlobalSaldo,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/transactions
 *
 * SIMPLIFIED: User only sends date, infakQris, infakTunai, isFridayHeld.
 * Backend auto-fetches saldoAwal from the last transaction, then the
 * pre-save hook computes totalInfak, saldoAkhir, etc.
 */
const createTransaction = async (req, res, next) => {
  try {
    const { date, isFridayHeld, skippedReason, infakQris, infakTunai, notes, otherCurrencies } = req.body;

    // Auto-fetch previous balance
    const latest = await Transaction.findOne().sort({ date: -1 });

    const saldoAwal = latest ? latest.saldoAkhir : 0;
    const prevQris = latest ? latest.saldoTotalQris : 0;
    const prevTunai = latest ? latest.saldoTotalTunai : 0;

    const newQris = isFridayHeld !== false ? (infakQris || 0) : 0;
    const newTunai = isFridayHeld !== false ? (infakTunai || 0) : 0;

    const transaction = await Transaction.create({
      date,
      isFridayHeld: isFridayHeld !== false,
      skippedReason: isFridayHeld === false ? skippedReason : null,
      infakQris: newQris,
      infakTunai: newTunai,
      saldoAwal,
      saldoTotalQris: prevQris + newQris,
      saldoTotalTunai: prevTunai + newTunai,
      notes: notes || null,
      otherCurrencies: otherCurrencies || [],
      createdBy: req.user._id,
    });

    res.status(201).json({ success: true, data: { transaction } });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/transactions/:id
 */
const updateTransaction = async (req, res, next) => {
  try {
    const transaction = await Transaction.findById(req.params.id);

    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Transaction not found.' });
    }

    // Only allow updating the input fields
    const allowedFields = [
      'date', 'isFridayHeld', 'skippedReason',
      'infakQris', 'infakTunai',
      'otherCurrencies', 'notes',
    ];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        transaction[field] = req.body[field];
      }
    });

    // Recalculate saldo based on previous transaction
    const prevTx = await Transaction.findOne({
      date: { $lt: transaction.date },
    }).sort({ date: -1 });

    transaction.saldoAwal = prevTx ? prevTx.saldoAkhir : 0;
    const prevQris = prevTx ? prevTx.saldoTotalQris : 0;
    const prevTunai = prevTx ? prevTx.saldoTotalTunai : 0;

    const qris = transaction.isFridayHeld ? (transaction.infakQris || 0) : 0;
    const tunai = transaction.isFridayHeld ? (transaction.infakTunai || 0) : 0;

    transaction.saldoTotalQris = prevQris + qris;
    transaction.saldoTotalTunai = prevTunai + tunai;

    transaction.updatedBy = req.user._id;
    await transaction.save(); // pre-save hook handles totalInfak, saldoAkhir, saldoTotalQrisTunai

    res.json({ success: true, data: { transaction } });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/transactions/:id  (superadmin only)
 */
const deleteTransaction = async (req, res, next) => {
  try {
    const transaction = await Transaction.findByIdAndDelete(req.params.id);

    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Transaction not found.' });
    }

    res.json({ success: true, message: 'Transaction deleted successfully.' });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAllTransactions,
  getTransaction,
  getLatestBalance,
  createTransaction,
  updateTransaction,
  deleteTransaction,
};
