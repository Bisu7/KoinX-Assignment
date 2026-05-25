const UserTransaction = require('../models/UserTransaction.model');
const ExchangeTransaction = require('../models/ExchangeTransaction.model');
const ReconciliationResult = require('../models/ReconciliationResult.model');
const ReconciliationRun = require('../models/ReconciliationRun.model');
const logger = require('../utils/logger');
const { isQuantityWithinTolerance } = require('../utils/matching/toleranceCalculator');
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
    await UserTransaction.updateMany({ isValid: true, status: 'pending' }, { $set: { status: 'processing', reconciliationRunId: run._id } });
    await ExchangeTransaction.updateMany({ isValid: true, status: 'pending' }, { $set: { status: 'processing', reconciliationRunId: run._id } });

    const matchedExchangeIds = new Set();
    let resultsBatch = [];
    let userUpdatesBatch = [];
    let exchangeUpdatesBatch = [];
    
    let totals = { matched: 0, unmatchedUser: 0, unmatchedExchange: 0, conflicting: 0 };

    const flushBatches = async () => {
      if (resultsBatch.length > 0) await ReconciliationResult.insertMany(resultsBatch);
      if (userUpdatesBatch.length > 0) await UserTransaction.bulkWrite(userUpdatesBatch);
      if (exchangeUpdatesBatch.length > 0) await ExchangeTransaction.bulkWrite(exchangeUpdatesBatch);
      resultsBatch = [];
      userUpdatesBatch = [];
      exchangeUpdatesBatch = [];
    };

    // 3. Process User Transactions Stream (Memory-safe Cursor)
    const userCursor = UserTransaction.find({ reconciliationRunId: run._id, status: 'processing' }).lean().cursor();

    for await (const uTx of userCursor) {
      const expectedExType = getExpectedExchangeType(uTx.normalizedType);
      
      // Calculate timestamp bounds for MongoDB Indexed Query
      const minTime = new Date(uTx.normalizedTimestamp.getTime() - config.timestampToleranceSeconds * 1000);
      const maxTime = new Date(uTx.normalizedTimestamp.getTime() + config.timestampToleranceSeconds * 1000);

      // Target candidates via B-Tree Index instead of in-memory maps
      const candidates = await ExchangeTransaction.find({
        reconciliationRunId: run._id,
        status: 'processing',
        normalizedAsset: uTx.normalizedAsset,
        normalizedType: expectedExType,
        normalizedTimestamp: { $gte: minTime, $lte: maxTime }
      }).lean();

      let bestCandidates = [];
      let bestScore = -1;

      // Filter against Set and Quantity boundaries
      const validCandidates = candidates.filter(exTx => 
        !matchedExchangeIds.has(exTx._id.toString()) && 
        isQuantityWithinTolerance(uTx.normalizedAmount, exTx.normalizedAmount, config.quantityTolerancePct)
      );

      for (const exTx of validCandidates) {
        const score = calculateScore(uTx, exTx, config);
        if (score >= config.matchScoreThreshold) {
          if (score > bestScore) {
            bestScore = score;
            bestCandidates = [exTx];
          } else if (score === bestScore) {
            bestCandidates.push(exTx);
          }
        }
      }

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
        totals.matched++;
        
        resultsBatch.push({
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
        userUpdatesBatch.push({ updateOne: { filter: { _id: uTx._id }, update: { $set: { status: 'matched' } } } });
        exchangeUpdatesBatch.push({ updateOne: { filter: { _id: matchedExTx._id }, update: { $set: { status: 'matched' } } } });
        
      } else if (bestCandidates.length > 1) {
        const conflictData = analyzeDuplicateCandidates(uTx, bestCandidates);
        totals.conflicting++;
        resultsBatch.push({
          ...baseResult,
          status: 'conflicting',
          reason: 'Multiple Identical Scores',
          discrepancyDetails: conflictData
        });
        userUpdatesBatch.push({ updateOne: { filter: { _id: uTx._id }, update: { $set: { status: 'conflicting' } } } });

      } else {
        totals.unmatchedUser++;
        resultsBatch.push({
          ...baseResult,
          status: 'unmatched_user',
          reason: 'No matching exchange transaction found'
        });
        userUpdatesBatch.push({ updateOne: { filter: { _id: uTx._id }, update: { $set: { status: 'unmatched_user' } } } });
      }

      // Check Batch size
      if (resultsBatch.length >= config.maxBatchSize) {
        await flushBatches();
      }
    }
    
    // Flush any remaining user transaction updates
    await flushBatches();

    // 4. Process Remaining Exchange Transactions Stream
    const exCursor = ExchangeTransaction.find({ reconciliationRunId: run._id, status: 'processing' }).lean().cursor();
    
    for await (const exTx of exCursor) {
      if (!matchedExchangeIds.has(exTx._id.toString())) {
        totals.unmatchedExchange++;
        resultsBatch.push({
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
        exchangeUpdatesBatch.push({ updateOne: { filter: { _id: exTx._id }, update: { $set: { status: 'unmatched_exchange' } } } });
      }

      if (resultsBatch.length >= config.maxBatchSize) {
        await flushBatches();
      }
    }
    
    // Flush final batch
    await flushBatches();

    // 5. Generate Summary
    run.status = 'completed';
    run.endTime = new Date();
    run.summary.totalMatched = totals.matched;
    run.summary.totalUnmatchedUser = totals.unmatchedUser;
    run.summary.totalUnmatchedExchange = totals.unmatchedExchange;
    run.summary.totalConflicting = totals.conflicting;
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
