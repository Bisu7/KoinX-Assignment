const mongoose = require('mongoose');

const userTransactionSchema = new mongoose.Schema(
  {
    reconciliationRunId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ReconciliationRun',
      required: true,
      index: true,
    },
    source: {
      type: String,
      required: true, // File name or origin
    },
    originalRow: {
      type: mongoose.Schema.Types.Mixed, // Stores the messy CSV row as an object or JSON string
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
      type: String, // e.g., 'BTC'
    },
    normalizedAmount: {
      type: mongoose.Types.Decimal128, // Critical for crypto precision
    },
    status: {
      type: String,
      enum: ['pending', 'processing', 'matched', 'unmatched_user', 'conflicting'],
      default: 'pending',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for fast reconciliation matching
userTransactionSchema.index({ reconciliationRunId: 1, normalizedTransactionId: 1 });
userTransactionSchema.index({ reconciliationRunId: 1, normalizedAsset: 1, normalizedType: 1 });
userTransactionSchema.index({ status: 1, reconciliationRunId: 1 });


// Compound index for high-performance matching queries
userTransactionSchema.index({
  status: 1,
  normalizedAsset: 1,
  normalizedType: 1,
  normalizedTimestamp: 1
});

const UserTransaction = mongoose.model('UserTransaction', userTransactionSchema);
module.exports = UserTransaction;
