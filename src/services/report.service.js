const mongoose = require('mongoose');
const ReconciliationResult = require('../models/ReconciliationResult.model');
const ReconciliationRun = require('../models/ReconciliationRun.model');
const ApiError = require('../utils/apiError');

const getFullReport = async (runId, query, pagination) => {
  const run = await ReconciliationRun.findOne({ runId }).lean();
  if (!run) throw new ApiError(404, 'Run ID not found');

  const filter = { reconciliationRunId: run._id };

  if (query.status) filter.status = query.status;
  if (query.reason) filter.reason = { $regex: query.reason, $options: 'i' };

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

const getRunSummary = async (runId) => {
  const run = await ReconciliationRun.findOne({ runId }).lean();
  if (!run) throw new ApiError(404, 'Run ID not found');

  const pipeline = [
    { $match: { reconciliationRunId: run._id } },
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

const getUnmatched = async (runId, pagination) => {
  const run = await ReconciliationRun.findOne({ runId }).lean();
  if (!run) throw new ApiError(404, 'Run ID not found');

  const filter = {
    reconciliationRunId: run._id,
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
