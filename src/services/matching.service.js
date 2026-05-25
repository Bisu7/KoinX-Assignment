const UserTransaction = require('../models/UserTransaction.model');
const ExchangeTransaction = require('../models/ExchangeTransaction.model');
const ReconciliationResult = require('../models/ReconciliationResult.model');
const ReconciliationRun = require('../models/ReconciliationRun.model');
const logger = require('../utils/logger');
const { isTimestampWithinTolerance, isQuantityWithinTolerance } = require('../utils/matching/toleranceCalculator');
const { calculateScore } = require('../utils/matching/matchScorer');
const { analyzeDuplicateCandidates } = require('../utils/matching/conflictAnalyzer');
const { TIMESTAMP_TOLERANCE_SECONDS } = require('../config/matching');

const getExpectedExchangeType = (userType) => {
  if (userType === 'TRANSFER_OUT') return 'TRANSFER_IN';
  if (userType === 'TRANSFER_IN') return 'TRANSFER_OUT';
  return userType; // BUY -> BUY, SELL -> SELL
};

const runMatchingEngine = async (runId) => {
  logger.info(`Starting matching engine for Run ID: ${runId}`);

  // Fetch all valid, pending transactions
  const userTxs = await UserTransaction.find({ reconciliationRunId: runId, isValid: true, status: 'pending' }).lean();
  const exchangeTxs = await ExchangeTransaction.find({ reconciliationRunId: runId, isValid: true, status: 'pending' }).lean();

  // Bucket Exchange Transactions
  // Structure: buckets[asset][type] = array of sorted txs
  const exBuckets = {};
  for (const exTx of exchangeTxs) {
    const asset = exTx.normalizedAsset;
    const type = exTx.normalizedType;
    if (!exBuckets[asset]) exBuckets[asset] = {};
    if (!exBuckets[asset][type]) exBuckets[asset][type] = [];
    exBuckets[asset][type].push(exTx);
  }

  // Sort each bucket by timestamp for sliding window efficiency
  for (const asset in exBuckets) {
    for (const type in exBuckets[asset]) {
      exBuckets[asset][type].sort((a, b) => a.normalizedTimestamp - b.normalizedTimestamp);
    }
  }

  const results = [];
  const matchedExchangeIds = new Set();
  const userUpdates = [];

  for (const uTx of userTxs) {
    const expectedExType = getExpectedExchangeType(uTx.normalizedType);
    const bucket = exBuckets[uTx.normalizedAsset]?.[expectedExType] || [];

    let bestCandidates = [];
    let bestScore = -1;

    // Sliding window / binary search approximation (using linear scan over sorted subset for now)
    // Since it's sorted, we could optimize further, but filtering by tolerance is O(K) where K is small
    const validCandidates = bucket.filter(exTx => 
      !matchedExchangeIds.has(exTx._id.toString()) && 
      isTimestampWithinTolerance(uTx.normalizedTimestamp, exTx.normalizedTimestamp) &&
      isQuantityWithinTolerance(uTx.normalizedAmount, exTx.normalizedAmount)
    );

    for (const exTx of validCandidates) {
      const score = calculateScore(uTx, exTx);

      if (score > bestScore) {
        bestScore = score;
        bestCandidates = [exTx];
      } else if (score === bestScore) {
        bestCandidates.push(exTx);
      }
    }

    if (bestCandidates.length === 1) {
      // 1-to-1 Match
      const matchedExTx = bestCandidates[0];
      matchedExchangeIds.add(matchedExTx._id.toString());

      results.push({
        reconciliationRunId: runId,
        status: 'matched',
        userTransactionId: uTx._id,
        exchangeTransactionId: matchedExTx._id,
        discrepancyDetails: { score: bestScore }
      });

      userUpdates.push({ updateOne: { filter: { _id: uTx._id }, update: { $set: { status: 'matched' } } } });

    } else if (bestCandidates.length > 1) {
      // Conflict: Multiple identical scores
      const conflictData = analyzeDuplicateCandidates(uTx, bestCandidates);
      results.push({
        reconciliationRunId: runId,
        status: 'conflicting',
        userTransactionId: uTx._id,
        discrepancyDetails: conflictData
      });
      userUpdates.push({ updateOne: { filter: { _id: uTx._id }, update: { $set: { status: 'conflicting' } } } });

    } else {
      // Unmatched User
      results.push({
        reconciliationRunId: runId,
        status: 'unmatched_user',
        userTransactionId: uTx._id,
      });
      userUpdates.push({ updateOne: { filter: { _id: uTx._id }, update: { $set: { status: 'unmatched_user' } } } });
    }
  }

  // Handle Unmatched Exchange Transactions
  const exchangeUpdates = [];
  for (const exTx of exchangeTxs) {
    if (!matchedExchangeIds.has(exTx._id.toString())) {
      results.push({
        reconciliationRunId: runId,
        status: 'unmatched_exchange',
        exchangeTransactionId: exTx._id,
      });
      exchangeUpdates.push({ updateOne: { filter: { _id: exTx._id }, update: { $set: { status: 'unmatched_exchange' } } } });
    } else {
      exchangeUpdates.push({ updateOne: { filter: { _id: exTx._id }, update: { $set: { status: 'matched' } } } });
    }
  }

  // Batch insert results and update statuses
  if (results.length > 0) {
    await ReconciliationResult.insertMany(results);
  }

  if (userUpdates.length > 0) {
    await UserTransaction.bulkWrite(userUpdates);
  }

  if (exchangeUpdates.length > 0) {
    await ExchangeTransaction.bulkWrite(exchangeUpdates);
  }

  // Update Run Summary
  const run = await ReconciliationRun.findById(runId);
  if (run) {
    run.status = 'completed';
    run.endTime = new Date();
    run.summary.totalMatched = results.filter(r => r.status === 'matched').length;
    run.summary.totalUnmatchedUser = results.filter(r => r.status === 'unmatched_user').length;
    run.summary.totalUnmatchedExchange = results.filter(r => r.status === 'unmatched_exchange').length;
    run.summary.totalConflicting = results.filter(r => r.status === 'conflicting').length;
    await run.save();
  }

  logger.info(`Matching completed for Run ID: ${runId}`);
  return run;
};

module.exports = {
  runMatchingEngine,
};
