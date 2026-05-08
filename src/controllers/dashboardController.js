'use strict';

const Transaction = require('../models/Transaction');
const Expense = require('../models/Expense');
const Income = require('../models/Income');

/**
 * GET /api/dashboard
 * Returns aggregated summary statistics.
 */
const getDashboard = async (req, res, next) => {
  try {
    // ── Determine date range filter (default: current year) ──────────────
    const now = new Date();
    const startDate = req.query.startDate
      ? new Date(req.query.startDate)
      : new Date(now.getFullYear(), 0, 1); // Jan 1 of current year
    const endDate = req.query.endDate
      ? new Date(req.query.endDate)
      : new Date(now.getFullYear(), 11, 31, 23, 59, 59);

    const dateFilter = { date: { $gte: startDate, $lte: endDate } };

    // ── Parallel queries ──────────────────────────────────────────────────
    const [
      transactionStats,
      totalExpenses,
      totalIncomes,
      latestTransaction,
      recentTransactions,
      globalInfakStats,
      globalExpStats,
      globalIncStats,
    ] = await Promise.all([
      // Aggregate infak totals and balance info
      Transaction.aggregate([
        { $match: { ...dateFilter, isFridayHeld: true } },
        {
          $group: {
            _id: null,
            totalInfakQris: { $sum: '$infakQris' },
            totalInfakTunai: { $sum: '$infakTunai' },
            totalInfak: { $sum: '$totalInfak' },
            count: { $sum: 1 },
          },
        },
      ]),

      // Total expenses in period
      Expense.aggregate([
        { $match: dateFilter },
        { $group: { _id: null, total: { $sum: { $add: [{ $ifNull: ['$amountQris', 0] }, { $ifNull: ['$amountTunai', 0] }, { $ifNull: ['$amount', 0] }] } } } },
      ]),

      // Total incomes in period
      Income.aggregate([
        { $match: dateFilter },
        { $group: { _id: null, total: { $sum: { $add: [{ $ifNull: ['$amountQris', 0] }, { $ifNull: ['$amountTunai', 0] }, { $ifNull: ['$amount', 0] }] } } } },
      ]),

      // Most recent transaction for current balances
      Transaction.findOne().sort({ date: -1 }),

      // Last 5 transactions
      Transaction.find()
        .sort({ date: -1 })
        .limit(5)
        .populate('createdBy', 'name'),
        
      // LIFETIME AGGREGATES FOR GLOBAL BALANCE
      Transaction.aggregate([{ $match: { isFridayHeld: true } }, { $group: { _id: null, qris: { $sum: '$infakQris' }, tunai: { $sum: '$infakTunai' } } }]),
      Expense.aggregate([{ $group: { _id: null, qris: { $sum: { $ifNull: ['$amountQris', 0] } }, tunai: { $sum: { $add: [{ $ifNull: ['$amountTunai', 0] }, { $ifNull: ['$amount', 0] }] } } } }]),
      Income.aggregate([{ $group: { _id: null, qris: { $sum: { $ifNull: ['$amountQris', 0] } }, tunai: { $sum: { $add: [{ $ifNull: ['$amountTunai', 0] }, { $ifNull: ['$amount', 0] }] } } } }])
    ]);

    const infakStats = transactionStats[0] || {
      totalInfakQris: 0,
      totalInfakTunai: 0,
      totalInfak: 0,
      count: 0,
    };

    const expenseTotal = totalExpenses[0]?.total || 0;
    const incomeTotal = totalIncomes[0]?.total || 0;

    // Count of Fridays skipped
    const skippedCount = await Transaction.countDocuments({
      ...dateFilter,
      isFridayHeld: false,
    });

    // Global Lifetime Balance Calculation
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
        period: { startDate, endDate },
        summary: {
          totalInfakQris: infakStats.totalInfakQris,
          totalInfakTunai: infakStats.totalInfakTunai,
          totalInfak: infakStats.totalInfak,
          totalExpenses: expenseTotal,
          totalIncomes: incomeTotal,
          netFlow: infakStats.totalInfak + incomeTotal - expenseTotal,
          fridaysHeld: infakStats.count,
          fridaysSkipped: skippedCount,
        },
        currentBalance: {
          saldoAkhir: currentGlobalSaldo,
          saldoTotalQris: currentGlobalQris,
          saldoTotalTunai: currentGlobalTunai,
          saldoTotalQrisTunai: currentGlobalSaldo,
          lastUpdated: new Date(),
        },
        recentTransactions,
      },
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { getDashboard };
