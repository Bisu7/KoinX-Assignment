const asyncHandler = require('../utils/asyncHandler');
const { sendResponse } = require('../utils/apiResponse');
const dataQualityService = require('../services/dataQuality.service');

const getIssues = asyncHandler(async (req, res) => {
  // Extract custom query filters
  const { reconciliationRunId, issueType, severity, source } = req.query;
  const query = { reconciliationRunId, issueType, severity, source };

  const data = await dataQualityService.getIssues(query, req.pagination);

  return sendResponse(res, 200, data, 'Data quality issues retrieved successfully');
});

const getSummaryMetrics = asyncHandler(async (req, res) => {
  const { runId } = req.query; // optional runId filter
  const summary = await dataQualityService.getSummaryMetrics(runId);
  return sendResponse(res, 200, summary, 'Data quality summary retrieved successfully');
});

module.exports = {
  getIssues,
  getSummaryMetrics,
};
