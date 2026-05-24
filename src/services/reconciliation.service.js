const UserTransaction = require('../models/UserTransaction.model');
const ExchangeTransaction = require('../models/ExchangeTransaction.model');
const ReconciliationResult = require('../models/ReconciliationResult.model');
const ReconciliationRun = require('../models/ReconciliationRun.model');
const logger = require('../utils/logger');
const { isTimestampWithinTolerance, isQuantityWithinTolerance } = require('../utils/matching/toleranceCalculator');
const { calculateScore } = require('../utils/matching/matchScorer');
const { analyzeDuplicateCandidates } = require('../utils/matching/conflictAnalyzer');

const getExpectedExchangeType = (userType) => {
  if (userType === 'TRANSFER_OUT') return 'TRANSFER_IN';
  if (userType === 'TRANSFER_IN') return 'TRANSFER_OUT';
  return userType;
};

const executeReconciliation = async (runName, config) => {
  const startTime = Date.now();
  
  // 1. Create a Reconciliation Run
  const runId = `REC-${Date.now()}`;
  const run = await ReconciliationRun.create({
    runId,
    status: 'reconciling',
    startTime: new Date(),
    sources: [runName]
  });

  logger.info(`Starting reconciliation for runName: ${runName}, Run ID: ${runId}`);

  try {
    // 2. Transaction Locking (Idempotency)
    // Update all 'pending' valid transactions to 'processing'
    await UserTransaction.updateMany({ isValid: true, status: 'pending' }, { $set: { status: 'processing', reconciliationRunId: run._id } });
    await ExchangeTransaction.updateMany({ isValid: true, status: 'pending' }, { $set: { status: 'processing', reconciliationRunId: run._id } });

    // Fetch the locked transactions
    const userTxs = await UserTransaction.find({ reconciliationRunId: run._id, status: 'processing' }).lean();
    const exchangeTxs = await ExchangeTransaction.find({ reconciliationRunId: run._id, status: 'processing' }).lean();

    // 3. Bucket Exchange Transactions
    const exBuckets = {};
    for (const exTx of exchangeTxs) {
      const asset = exTx.normalizedAsset;
      const type = exTx.normalizedType;
      if (!exBuckets[asset]) exBuckets[asset] = {};
      if (!exBuckets[asset][type]) exBuckets[asset][type] = [];
      exBuckets[asset][type].push(exTx);
    }

    for (const asset in exBuckets) {
      for (const type in exBuckets[asset]) {
        exBuckets[asset][type].sort((a, b) => a.normalizedTimestamp - b.normalizedTimestamp);
      }
    }

    const results = [];
    const matchedExchangeIds = new Set();
    const userUpdates = [];
    
    // 4. Matching Logic
    for (const uTx of userTxs) {
      const expectedExType = getExpectedExchangeType(uTx.normalizedType);
      const bucket = exBuckets[uTx.normalizedAsset]?.[expectedExType] || [];

      let bestCandidates = [];
      let bestScore = -1;

      const validCandidates = bucket.filter(exTx => 
        !matchedExchangeIds.has(exTx._id.toString()) && 
        isTimestampWithinTolerance(uTx.normalizedTimestamp, exTx.normalizedTimestamp, config.timestampToleranceSeconds) &&
        isQuantityWithinTolerance(uTx.normalizedAmount, exTx.normalizedAmount, config.quantityTolerancePct)
      );

      for (const exTx of validCandidates) {
        const score = calculateScore(uTx, exTx, config);
        // Only accept if above threshold
        if (score >= config.matchScoreThreshold) {
          if (score > bestScore) {
            bestScore = score;
            bestCandidates = [exTx];
          } else if (score === bestScore) {
            bestCandidates.push(exTx);
          }
        }
      }

      // 5. Generate Report Entries
      const baseResult = {
        reconciliationRunId: run._id,
        userTransactionId: uTx._id,
        originalUserRow: uTx.originalRow,
        normalizedUserValues: {
          id: uTx.normalizedTransactionId,
          type: uTx.normalizedType,
          asset: uTx.normalizedAsset,
          amount: uTx.normalizedAmount.toString(),
          timestamp: uTx.normalizedTimestamp
        },
        toleranceUsed: {
          timestampToleranceSeconds: config.timestampToleranceSeconds,
          quantityTolerancePct: config.quantityTolerancePct,
          matchScoreThreshold: config.matchScoreThreshold,
        },
      };

      if (bestCandidates.length === 1) {
        const matchedExTx = bestCandidates[0];
        matchedExchangeIds.add(matchedExTx._id.toString());
        
        results.push({
          ...baseResult,
          status: 'matched',
          exchangeTransactionId: matchedExTx._id,
          originalExchangeRow: matchedExTx.originalRow,
          normalizedExchangeValues: {
             id: matchedExTx.normalizedTransactionId,
             type: matchedExTx.normalizedType,
             asset: matchedExTx.normalizedAsset,
             amount: matchedExTx.normalizedAmount.toString(),
             timestamp: matchedExTx.normalizedTimestamp
          },
          confidenceScore: bestScore,
          reason: 'Perfect or Fuzzy Match within Tolerance'
        });

        userUpdates.push({ updateOne: { filter: { _id: uTx._id }, update: { $set: { status: 'matched' } } } });
        
      } else if (bestCandidates.length > 1) {
        const conflictData = analyzeDuplicateCandidates(uTx, bestCandidates);
        results.push({
          ...baseResult,
          status: 'conflicting',
          reason: 'Multiple Identical Scores',
          discrepancyDetails: conflictData
        });
        userUpdates.push({ updateOne: { filter: { _id: uTx._id }, update: { $set: { status: 'conflicting' } } } });

      } else {
        results.push({
          ...baseResult,
          status: 'unmatched_user',
          reason: 'No matching exchange transaction found'
        });
        userUpdates.push({ updateOne: { filter: { _id: uTx._id }, update: { $set: { status: 'unmatched_user' } } } });
      }
    }

    // 6. Handle Unmatched Exchange Transactions
    const exchangeUpdates = [];
    for (const exTx of exchangeTxs) {
      if (!matchedExchangeIds.has(exTx._id.toString())) {
        results.push({
          reconciliationRunId: run._id,
          status: 'unmatched_exchange',
          exchangeTransactionId: exTx._id,
          originalExchangeRow: exTx.originalRow,
          normalizedExchangeValues: {
             id: exTx.normalizedTransactionId,
             type: exTx.normalizedType,
             asset: exTx.normalizedAsset,
             amount: exTx.normalizedAmount.toString(),
             timestamp: exTx.normalizedTimestamp
          },
          reason: 'No matching user transaction found',
          toleranceUsed: {
            timestampToleranceSeconds: config.timestampToleranceSeconds,
            quantityTolerancePct: config.quantityTolerancePct,
            matchScoreThreshold: config.matchScoreThreshold,
          },
        });
        exchangeUpdates.push({ updateOne: { filter: { _id: exTx._id }, update: { $set: { status: 'unmatched_exchange' } } } });
      } else {
        exchangeUpdates.push({ updateOne: { filter: { _id: exTx._id }, update: { $set: { status: 'matched' } } } });
      }
    }

    // 7. Save Results and Updates
    if (results.length > 0) {
      await ReconciliationResult.insertMany(results);
    }
    
    if (userUpdates.length > 0) await UserTransaction.bulkWrite(userUpdates);
    if (exchangeUpdates.length > 0) await ExchangeTransaction.bulkWrite(exchangeUpdates);

    // 8. Generate Summary
    run.status = 'completed';
    run.endTime = new Date();
    run.summary.totalMatched = results.filter(r => r.status === 'matched').length;
    run.summary.totalUnmatchedUser = results.filter(r => r.status === 'unmatched_user').length;
    run.summary.totalUnmatchedExchange = results.filter(r => r.status === 'unmatched_exchange').length;
    run.summary.totalConflicting = results.filter(r => r.status === 'conflicting').length;
    await run.save();

    const executionTimeMs = Date.now() - startTime;
    logger.info(`Reconciliation completed for Run ID: ${runId} in ${executionTimeMs}ms`);
    
    return {
      runId: run.runId,
      executionTimeMs,
      summary: run.summary,
    };

  } catch (error) {
    logger.error(`Reconciliation failed: ${error.message}`);
    run.status = 'failed';
    run.errorMessage = error.message;
    await run.save();
    
    // Partial Failure Handle: Unlock locked transactions
    await UserTransaction.updateMany({ reconciliationRunId: run._id, status: 'processing' }, { $set: { status: 'pending', reconciliationRunId: null } });
    await ExchangeTransaction.updateMany({ reconciliationRunId: run._id, status: 'processing' }, { $set: { status: 'pending', reconciliationRunId: null } });
    
    throw error;
  }
};

module.exports = {
  executeReconciliation,
};
