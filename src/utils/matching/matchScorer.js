/**
 * Calculates a confidence score [0-100] between two transactions.
 * Exact match = 100.
 */
const calculateScore = (userTx, exchangeTx) => {
  let score = 100;

  const t1 = userTx.normalizedTimestamp.getTime();
  const t2 = exchangeTx.normalizedTimestamp.getTime();
  const diffSeconds = Math.abs(t1 - t2) / 1000;

  // Penalize by timestamp diff (max penalty 20 points for 300 seconds)
  if (diffSeconds > 0) {
    const timePenalty = Math.min((diffSeconds / 300) * 20, 20);
    score -= timePenalty;
  }

  const q1 = Number(userTx.normalizedAmount.toString());
  const q2 = Number(exchangeTx.normalizedAmount.toString());
  
  // Penalize by amount diff
  if (q1 !== q2) {
    const diff = Math.abs(q1 - q2);
    const avg = (q1 + q2) / 2;
    const pctDiff = diff / avg;
    
    // 1% max tolerance translates to 30 penalty points
    const amountPenalty = Math.min((pctDiff / 0.01) * 30, 30);
    score -= amountPenalty;
  }

  return Math.round(score * 100) / 100; // Round to 2 decimal places
};

module.exports = {
  calculateScore,
};
