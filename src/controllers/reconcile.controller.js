const asyncHandler = require('../utils/asyncHandler');
const { sendResponse } = require('../utils/apiResponse');
const ApiError = require('../utils/apiError');
const reconciliationService = require('../services/reconciliation.service');
const { getMergedConfig } = require('../config/reconciliation.config');

const reconcile = asyncHandler(async (req, res) => {
  const { runName = 'Default Run', ...overrides } = req.body;

  let config;
  try {
    config = getMergedConfig(overrides);
  } catch (error) {
    throw new ApiError(400, error.message);
  }

  const result = await reconciliationService.executeReconciliation(runName, config);

  return sendResponse(res, 200, result, 'Reconciliation completed successfully');
});

module.exports = {
  reconcile,
};
