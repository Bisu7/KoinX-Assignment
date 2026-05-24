const mongoose = require('mongoose');

const reconciliationResultSchema = new mongoose.Schema(
  {
    reconciliationRunId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ReconciliationRun',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['matched', 'conflicting', 'unmatched_user', 'unmatched_exchange'],
      required: true,
      index: true,
    },
    userTransactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'UserTransaction',
      default: null,
    },
    exchangeTransactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ExchangeTransaction',
      default: null,
    },
    // Rich Report Details
    originalUserRow: {
      type: mongoose.Schema.Types.Mixed,
    },
    originalExchangeRow: {
      type: mongoose.Schema.Types.Mixed,
    },
    normalizedUserValues: {
      type: mongoose.Schema.Types.Mixed,
    },
    normalizedExchangeValues: {
      type: mongoose.Schema.Types.Mixed,
    },
    confidenceScore: {
      type: Number,
    },
    toleranceUsed: {
      timestampToleranceSeconds: Number,
      quantityTolerancePct: Number,
    },
    reason: {
      type: String, // E.g., 'Perfect Match', 'Missing from Exchange'
    },
    discrepancyDetails: {
      type: mongoose.Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  }
);

reconciliationResultSchema.index({ reconciliationRunId: 1, status: 1 });

const ReconciliationResult = mongoose.model('ReconciliationResult', reconciliationResultSchema);
module.exports = ReconciliationResult;
