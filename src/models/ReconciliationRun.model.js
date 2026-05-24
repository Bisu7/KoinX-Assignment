const mongoose = require('mongoose');

const reconciliationRunSchema = new mongoose.Schema(
  {
    runId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['initializing', 'ingesting', 'reconciling', 'completed', 'failed'],
      default: 'initializing',
    },
    startTime: {
      type: Date,
    },
    endTime: {
      type: Date,
    },
    sources: {
      type: [String], // E.g., ['user_system_csv', 'exchange_binance_csv']
      default: [],
    },
    summary: {
      totalUserTransactions: { type: Number, default: 0 },
      totalExchangeTransactions: { type: Number, default: 0 },
      totalMatched: { type: Number, default: 0 },
      totalUnmatchedUser: { type: Number, default: 0 },
      totalUnmatchedExchange: { type: Number, default: 0 },
      totalConflicting: { type: Number, default: 0 },
      totalDataQualityIssues: { type: Number, default: 0 },
    },
    errorMessage: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

const ReconciliationRun = mongoose.model('ReconciliationRun', reconciliationRunSchema);
module.exports = ReconciliationRun;
