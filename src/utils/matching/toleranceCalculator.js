const { TIMESTAMP_TOLERANCE_SECONDS, QUANTITY_TOLERANCE_PCT } = require('../../config/matching');

/**
 * Checks if two timestamps are within tolerance
 */
const isTimestampWithinTolerance = (time1, time2) => {
  if (!time1 || !time2) return false;
  const diffSeconds = Math.abs(time1.getTime() - time2.getTime()) / 1000;
  return diffSeconds <= TIMESTAMP_TOLERANCE_SECONDS;
};

/**
 * Checks if two quantities are within tolerance percentage
 */
const isQuantityWithinTolerance = (qty1, qty2) => {
  if (!qty1 || !qty2) return false;
  
  // Convert Decimal128 to Number for percentage math.
  // Note: For ultra high-precision beyond IEEE 754 float bounds, 
  // you would use a library like bignumber.js here. 
  // Number is sufficient for checking 1% tolerance on typical crypto amounts.
  const num1 = Number(qty1.toString());
  const num2 = Number(qty2.toString());

  if (num1 === num2) return true;
  if (num1 === 0 || num2 === 0) return false; // Prevent division by zero if one is exactly 0 and other isn't

  const diff = Math.abs(num1 - num2);
  const avg = (num1 + num2) / 2;
  const pctDiff = diff / avg;

  return pctDiff <= QUANTITY_TOLERANCE_PCT;
};

module.exports = {
  isTimestampWithinTolerance,
  isQuantityWithinTolerance,
};
