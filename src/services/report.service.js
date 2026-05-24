const mongoose = require('mongoose');
const ReconciliationResult = require('../models/ReconciliationResult.model');

/**
 * Retrieves the full report with optional filtering and pagination
 */
const getFullReport = async (runId, query, pagination) => {
  const filter = { reconciliationRunId: runId };

  if (query.status) filter.status = query.status;
  if (query.reason) filter.reason = { $regex: query.reason, $options: 'i' };

  // If we want all records for CSV export, we might ignore pagination limit
  const limit = query.format === 'csv' ? 0 : pagination.limit;
  
  const queryChain = ReconciliationResult.find(filter)
    .sort(pagination.sort)
    .skip(pagination.skip)
    .lean();

  if (limit > 0) {
    queryChain.limit(limit);
  }

  const results = await queryChain.exec();
  const total = await ReconciliationResult.countDocuments(filter);

  return {
    results,
    page: pagination.page,
    limit: pagination.limit,
    totalPages: limit > 0 ? Math.ceil(total / limit) : 1,
    totalResults: total,
  };
};

/**
 * Calculates summary metrics directly using MongoDB Aggregation
 */
const getRunSummary = async (runId) => {
  const pipeline = [
    { $match: { reconciliationRunId: new mongoose.Types.ObjectId(runId) } },
    {
      $group: {
        _id: null,
        totalProcessed: { $sum: 1 },
        matched: { $sum: { $cond: [{ $eq: ['$status', 'matched'] }, 1, 0] } },
        conflicting: { $sum: { $cond: [{ $eq: ['$status', 'conflicting'] }, 1, 0] } },
        unmatchedUser: { $sum: { $cond: [{ $eq: ['$status', 'unmatched_user'] }, 1, 0] } },
        unmatchedExchange: { $sum: { $cond: [{ $eq: ['$status', 'unmatched_exchange'] }, 1, 0] } },
      },
    },
    {
      $project: {
        _id: 0,
        totalProcessed: 1,
        matched: 1,
        conflicting: 1,
        unmatchedUser: 1,
        unmatchedExchange: 1,
        successRate: {
          $cond: [
            { $gt: ['$totalProcessed', 0] },
            { $multiply: [{ $divide: ['$matched', '$totalProcessed'] }, 100] },
            0,
          ],
        },
      },
    },
  ];

  const result = await ReconciliationResult.aggregate(pipeline);
  return result.length > 0 ? result[0] : { totalProcessed: 0 };
};

/**
 * Retrieves only unmatched rows
 */
const getUnmatched = async (runId, pagination) => {
  const filter = {
    reconciliationRunId: runId,
    status: { $in: ['unmatched_user', 'unmatched_exchange'] },
  };

  const results = await ReconciliationResult.find(filter)
    .sort(pagination.sort)
    .skip(pagination.skip)
    .limit(pagination.limit)
    .lean();

  const total = await ReconciliationResult.countDocuments(filter);

  return {
    results,
    page: pagination.page,
    limit: pagination.limit,
    totalPages: Math.ceil(total / pagination.limit),
    totalResults: total,
  };
};

module.exports = {
  getFullReport,
  getRunSummary,
  getUnmatched,
};
