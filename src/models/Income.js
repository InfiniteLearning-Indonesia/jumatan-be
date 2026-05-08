'use strict';

const mongoose = require('mongoose');

/**
 * Income model for recording non-infak income (e.g. donations, transfers).
 */
const incomeSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: [true, 'Date is required'],
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true,
      maxlength: [100, 'Category must be at most 100 characters'],
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      maxlength: [500, 'Description must be at most 500 characters'],
    },
    amountQris: {
      type: Number,
      default: 0,
      min: [0, 'QRIS amount cannot be negative'],
    },
    amountTunai: {
      type: Number,
      default: 0,
      min: [0, 'Tunai amount cannot be negative'],
    },
    currency: {
      type: String,
      default: 'IDR',
      trim: true,
      uppercase: true,
      maxlength: 10,
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

// Virtual for total amount
incomeSchema.virtual('amount')
  .get(function () {
    const qris = this.amountQris || 0;
    const tunai = this.amountTunai || 0;
    // If there's a legacy 'amount' stored in document before schema change, include it
    const legacy = this._doc && this._doc.amount ? this._doc.amount : 0;
    return qris + tunai + legacy;
  })
  .set(function (val) {
    this.amountTunai = val;
  });

incomeSchema.index({ date: -1 });
incomeSchema.index({ category: 1 });

const Income = mongoose.model('Income', incomeSchema);

module.exports = Income;
