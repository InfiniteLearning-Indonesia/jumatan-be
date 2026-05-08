'use strict';

const mongoose = require('mongoose');

/**
 * Transaction represents a single Friday prayer collection event.
 * It records both QRIS and cash infak, balances, and supports
 * multi-currency balances via an array of otherCurrencies.
 *
 * SIMPLIFIED: Most saldo fields are now auto-computed.
 * User only needs to provide: date, infakQris, infakTunai.
 * The backend auto-fetches saldoAwal from the previous transaction
 * and computes all downstream values.
 */
const otherCurrencySchema = new mongoose.Schema(
  {
    currency: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 10,
    },
    amount: {
      type: Number,
      required: true,
      min: [0, 'Amount cannot be negative'],
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 500,
    },
  },
  { _id: false }
);

const transactionSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: [true, 'Date is required'],
    },

    // Whether Friday prayer was held this week
    isFridayHeld: {
      type: Boolean,
      default: true,
    },
    skippedReason: {
      type: String,
      trim: true,
      maxlength: [500, 'Reason must be at most 500 characters'],
      default: null,
    },

    // Infak amounts  (IDR, in rupiah) — USER INPUT
    infakQris: {
      type: Number,
      default: 0,
      min: [0, 'Infak QRIS cannot be negative'],
    },
    infakTunai: {
      type: Number,
      default: 0,
      min: [0, 'Infak tunai cannot be negative'],
    },

    // AUTO-COMPUTED: infakQris + infakTunai
    totalInfak: {
      type: Number,
      default: 0,
      min: [0, 'Total infak cannot be negative'],
    },

    // Running balances (IDR)
    saldoAwal: {
      type: Number,
      required: [true, 'Saldo awal is required'],
      min: [0, 'Saldo awal cannot be negative'],
    },
    // AUTO-COMPUTED: saldoAwal + totalInfak
    saldoAkhir: {
      type: Number,
      default: 0,
      min: [0, 'Saldo akhir cannot be negative'],
    },
    // AUTO-COMPUTED: saldoTotalQris + saldoTotalTunai
    saldoTotalQrisTunai: {
      type: Number,
      default: 0,
      min: [0, 'Saldo total cannot be negative'],
    },
    saldoTotalQris: {
      type: Number,
      default: 0,
      min: [0, 'Saldo QRIS cannot be negative'],
    },
    saldoTotalTunai: {
      type: Number,
      default: 0,
      min: [0, 'Saldo tunai cannot be negative'],
    },

    // Multi-currency balances (e.g. USD, MYR donations)
    otherCurrencies: {
      type: [otherCurrencySchema],
      default: [],
    },

    notes: {
      type: String,
      trim: true,
      maxlength: [1000, 'Notes must be at most 1000 characters'],
      default: null,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Ensure only one transaction per date
transactionSchema.index({ date: 1 }, { unique: true });

/**
 * Auto-compute derived fields before saving.
 * - totalInfak = infakQris + infakTunai
 * - saldoAkhir = saldoAwal + totalInfak
 * - saldoTotalQrisTunai = saldoTotalQris + saldoTotalTunai
 */
transactionSchema.pre('save', function () {
  if (this.isFridayHeld) {
    // Always compute totalInfak from components
    this.totalInfak = this.infakQris + this.infakTunai;
  } else {
    // If Friday prayer was not held, zeroise infak fields
    this.infakQris = 0;
    this.infakTunai = 0;
    this.totalInfak = 0;
  }

  // Auto-compute saldoAkhir
  this.saldoAkhir = this.saldoAwal + this.totalInfak;

  // Auto-compute combined QRIS+Tunai total
  this.saldoTotalQrisTunai = this.saldoTotalQris + this.saldoTotalTunai;
});

const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = Transaction;
