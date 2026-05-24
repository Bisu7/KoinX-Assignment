const mongoose = require('mongoose');

const dataQualityIssueSchema = new mongoose.Schema(
  {
    reconciliationRunId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ReconciliationRun',
      required: true,
      index: true,
    },
    recordType: {
      type: String,
      enum: ['UserTransaction', 'ExchangeTransaction'],
      required: true,
    },
    source: {
      type: String,
      required: true, // e.g., filename
    },
    originalRow: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    issueType: {
      type: String,
      enum: [
        'malformed_timestamp',
        'missing_quantity',
        'unknown_asset',
        'duplicate_id',
        'unknown_type',
        'parsing_error',
      ],
      required: true,
    },
    severity: {
      type: String,
      enum: ['warning', 'critical'],
      default: 'warning',
    },
    description: {
      type: String,
    },
    resolved: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

dataQualityIssueSchema.index({ reconciliationRunId: 1, issueType: 1 });
dataQualityIssueSchema.index({ reconciliationRunId: 1, severity: 1 });

const DataQualityIssue = mongoose.model('DataQualityIssue', dataQualityIssueSchema);
module.exports = DataQualityIssue;
