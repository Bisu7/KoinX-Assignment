const { calculateScore } = require('../../src/utils/matching/matchScorer');

describe('Match Scorer', () => {
  const tolerances = { timestampToleranceSeconds: 300, quantityTolerancePct: 0.01 };

  it('should return 100 for exact matches', () => {
    const userTx = {
      normalizedTimestamp: new Date('2023-01-01T12:00:00Z'),
      normalizedAmount: '1.5',
    };
    const exchangeTx = {
      normalizedTimestamp: new Date('2023-01-01T12:00:00Z'),
      normalizedAmount: '1.5',
    };

    const score = calculateScore(userTx, exchangeTx, tolerances);
    expect(score).toBe(100);
  });

  it('should penalize timestamp drift proportionally up to 20 points', () => {
    const userTx = {
      normalizedTimestamp: new Date('2023-01-01T12:00:00Z'),
      normalizedAmount: '1.5',
    };
    // 150 seconds drift is exactly half the 300s tolerance -> 10 point penalty
    const exchangeTx = {
      normalizedTimestamp: new Date('2023-01-01T12:02:30Z'),
      normalizedAmount: '1.5',
    };

    const score = calculateScore(userTx, exchangeTx, tolerances);
    expect(score).toBe(90);
  });

  it('should penalize quantity drift proportionally up to 30 points', () => {
    const userTx = {
      normalizedTimestamp: new Date('2023-01-01T12:00:00Z'),
      normalizedAmount: '100',
    };
    // 0.5% drift is exactly half the 1% tolerance -> 15 point penalty
    const exchangeTx = {
      normalizedTimestamp: new Date('2023-01-01T12:00:00Z'),
      normalizedAmount: '100.5',
    };

    const score = calculateScore(userTx, exchangeTx, tolerances);
    // Average is 100.25, diff is 0.5, pctDiff is 0.0049875. 
    // Penalty = (0.0049875 / 0.01) * 30 = 14.9625
    // Score = 100 - 14.9625 = 85.0375 => rounded to 85.04
    expect(score).toBeCloseTo(85.04, 1);
  });
});
