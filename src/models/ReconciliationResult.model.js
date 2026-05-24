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
    discrepancyDetails: {
      type: mongoose.Schema.Types.Mixed,
      // e.g., { type: 'amount_mismatch', userAmount: 1.5, exchangeAmount: 1.4 }
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for querying results by run and status
reconciliationResultSchema.index({ reconciliationRunId: 1, status: 1 });

const ReconciliationResult = mongoose.model('ReconciliationResult', reconciliationResultSchema);
module.exports = ReconciliationResult;
