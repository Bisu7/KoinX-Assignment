const { normalizeAsset, normalizeType } = require('./aliasMapper');

/**
 * Validates and normalizes a row
 * @returns { isValid: boolean, normalized: Object, error: string|null, errorType: string|null }
 */
const validateAndNormalizeRow = (row) => {
  const { transaction_id, timestamp, type, asset, quantity, price_usd, fee } = row;

  if (!transaction_id) {
    return { isValid: false, normalized: null, error: 'Missing transaction_id', errorType: 'parsing_error' };
  }

  if (!asset) {
    return { isValid: false, normalized: null, error: 'Missing asset', errorType: 'unknown_asset' };
  }

  // Parse Timestamp
  if (!timestamp) {
    return { isValid: false, normalized: null, error: 'Missing timestamp', errorType: 'malformed_timestamp' };
  }
  
  const parsedTimestamp = new Date(timestamp);
  if (isNaN(parsedTimestamp.getTime())) {
    return { isValid: false, normalized: null, error: 'Malformed timestamp', errorType: 'malformed_timestamp' };
  }

  // Parse Quantity
  if (!quantity) {
    return { isValid: false, normalized: null, error: 'Missing quantity', errorType: 'missing_quantity' };
  }
  
  const numQuantity = Number(quantity);
  if (isNaN(numQuantity)) {
    return { isValid: false, normalized: null, error: 'Quantity must be numeric', errorType: 'missing_quantity' };
  }
  
  if (numQuantity < 0) {
    return { isValid: false, normalized: null, error: 'Quantity cannot be negative', errorType: 'missing_quantity' };
  }

  const normalizedType = normalizeType(type);
  if (normalizedType === 'UNKNOWN' || !normalizedType) {
    return { isValid: false, normalized: null, error: 'Unknown transaction type', errorType: 'unknown_type' };
  }

  return {
    isValid: true,
    normalized: {
      normalizedTransactionId: transaction_id.trim(),
      normalizedTimestamp: parsedTimestamp,
      normalizedType,
      normalizedAsset: normalizeAsset(asset),
      normalizedAmount: String(numQuantity), // Passed as string to Decimal128
    },
    error: null,
    errorType: null,
  };
};

module.exports = {
  validateAndNormalizeRow,
};
