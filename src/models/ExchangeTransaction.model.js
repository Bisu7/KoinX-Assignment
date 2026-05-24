const mongoose = require('mongoose');

const exchangeTransactionSchema = new mongoose.Schema(
  {
    reconciliationRunId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ReconciliationRun',
      required: true,
      index: true,
    },
    source: {
      type: String,
      required: true, // e.g., 'binance', 'coinbase'
    },
    originalRow: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    isValid: {
      type: Boolean,
      default: true,
      index: true,
    },
    normalizedTransactionId: {
      type: String,
      index: true,
    },
    normalizedTimestamp: {
      type: Date,
    },
    normalizedType: {
      type: String,
      enum: ['TRANSFER_IN', 'TRANSFER_OUT', 'BUY', 'SELL', 'TRADE', 'UNKNOWN'],
    },
    normalizedAsset: {
      type: String,
    },
    normalizedAmount: {
      type: mongoose.Types.Decimal128,
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'matched', 'unmatched_exchange', 'conflicting'],
      default: 'pending',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for matching
exchangeTransactionSchema.index({ reconciliationRunId: 1, normalizedTransactionId: 1 });
exchangeTransactionSchema.index({ reconciliationRunId: 1, normalizedAsset: 1, normalizedType: 1 });
exchangeTransactionSchema.index({ status: 1, reconciliationRunId: 1 });

const ExchangeTransaction = mongoose.model('ExchangeTransaction', exchangeTransactionSchema);
module.exports = ExchangeTransaction;
