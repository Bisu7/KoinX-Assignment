const { isTimestampWithinTolerance, isQuantityWithinTolerance } = require('./toleranceCalculator');

/**
 * Identifies why two transactions within the same bucket failed to match
 */
const analyzeConflict = (userTx, exchangeTx) => {
  if (userTx.normalizedAsset !== exchangeTx.normalizedAsset) {
    return 'asset mismatch';
  }

  if (!isTimestampWithinTolerance(userTx.normalizedTimestamp, exchangeTx.normalizedTimestamp)) {
    return 'timestamp mismatch';
  }

  if (!isQuantityWithinTolerance(userTx.normalizedAmount, exchangeTx.normalizedAmount)) {
    return 'quantity mismatch';
  }

  return 'unknown conflict';
};

/**
 * Handles multiple candidates returning identical top scores
 */
const analyzeDuplicateCandidates = (userTx, candidates) => {
  return {
    conflictReason: 'duplicate candidates',
    details: `User tx ${userTx.normalizedTransactionId} matches ${candidates.length} exchange transactions with identical scores.`,
    candidateIds: candidates.map(c => c.normalizedTransactionId),
  };
};

module.exports = {
  analyzeConflict,
  analyzeDuplicateCandidates,
};
