
const calculateScore = (userTx, exchangeTx, tolerances) => {
  let score = 100;
  const { timestampToleranceSeconds, quantityTolerancePct } = tolerances;

  const t1 = userTx.normalizedTimestamp.getTime();
  const t2 = exchangeTx.normalizedTimestamp.getTime();
  const diffSeconds = Math.abs(t1 - t2) / 1000;

  // Penalize by timestamp diff (max penalty 20 points)
  if (diffSeconds > 0 && timestampToleranceSeconds > 0) {
    const timePenalty = Math.min((diffSeconds / timestampToleranceSeconds) * 20, 20);
    score -= timePenalty;
  }

  const q1 = Number(userTx.normalizedAmount.toString());
  const q2 = Number(exchangeTx.normalizedAmount.toString());

  // Penalize by amount diff (max penalty 30 points)
  if (q1 !== q2 && quantityTolerancePct > 0) {
    const diff = Math.abs(q1 - q2);
    const avg = (q1 + q2) / 2;
    const pctDiff = diff / avg;

    const amountPenalty = Math.min((pctDiff / quantityTolerancePct) * 30, 30);
    score -= amountPenalty;
  }

  return Math.round(score * 100) / 100;
};

module.exports = {
  calculateScore,
};
