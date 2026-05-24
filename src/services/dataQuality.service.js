const mongoose = require('mongoose');
const DataQualityIssue = require('../models/DataQualityIssue.model');

/**
 * Retrieves a paginated list of data quality issues
 */
const getIssues = async (query, pagination) => {
  const filter = {};

  if (query.reconciliationRunId) filter.reconciliationRunId = query.reconciliationRunId;
  if (query.issueType) filter.issueType = query.issueType;
  if (query.severity) filter.severity = query.severity;
  if (query.source) filter.source = query.source;

  const results = await DataQualityIssue.find(filter)
    .sort(pagination.sort)
    .skip(pagination.skip)
    .limit(pagination.limit)
    .lean();

  const total = await DataQualityIssue.countDocuments(filter);

  return {
    results,
    page: pagination.page,
    limit: pagination.limit,
    totalPages: Math.ceil(total / pagination.limit),
    totalResults: total,
  };
};

/**
 * Calculates data quality summary metrics using MongoDB Aggregation
 */
const getSummaryMetrics = async (runId) => {
  const matchStage = runId ? { $match: { reconciliationRunId: new mongoose.Types.ObjectId(runId) } } : { $match: {} };

  const pipeline = [
    matchStage,
    {
      $facet: {
        bySeverity: [
          { $group: { _id: '$severity', count: { $sum: 1 } } },
          { $project: { _id: 0, severity: '$_id', count: 1 } }
        ],
        byIssueType: [
          { $group: { _id: '$issueType', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $project: { _id: 0, issueType: '$_id', count: 1 } }
        ],
        totalIssues: [
          { $count: 'count' }
        ]
      }
    }
  ];

  const result = await DataQualityIssue.aggregate(pipeline);
  
  if (!result || result.length === 0) {
    return { totalIssues: 0, bySeverity: [], byIssueType: [] };
  }

  const facetResult = result[0];
  
  return {
    totalIssues: facetResult.totalIssues.length > 0 ? facetResult.totalIssues[0].count : 0,
    bySeverity: facetResult.bySeverity,
    byIssueType: facetResult.byIssueType
  };
};

module.exports = {
  getIssues,
  getSummaryMetrics,
};
