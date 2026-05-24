/**
 * Checks if two timestamps are within tolerance
 */
const isTimestampWithinTolerance = (time1, time2, toleranceSeconds) => {
  if (!time1 || !time2) return false;
  const diffSeconds = Math.abs(time1.getTime() - time2.getTime()) / 1000;
  return diffSeconds <= toleranceSeconds;
};

/**
 * Checks if two quantities are within tolerance percentage
 */
const isQuantityWithinTolerance = (qty1, qty2, tolerancePct) => {
  if (!qty1 || !qty2) return false;
  
  const num1 = Number(qty1.toString());
  const num2 = Number(qty2.toString());

  if (num1 === num2) return true;
  if (num1 === 0 || num2 === 0) return false;

  const diff = Math.abs(num1 - num2);
  const avg = (num1 + num2) / 2;
  const pctDiff = diff / avg;

  return pctDiff <= tolerancePct;
};

module.exports = {
  isTimestampWithinTolerance,
  isQuantityWithinTolerance,
};
