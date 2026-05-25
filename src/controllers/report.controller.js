const asyncHandler = require('../utils/asyncHandler');
const { sendResponse } = require('../utils/apiResponse');
const reportService = require('../services/report.service');
const { exportToCsv } = require('../utils/csvExporter');

const getFullReport = asyncHandler(async (req, res) => {
  const { runId } = req.params;

  // Extract query parameters specifically handled outside pagination
  const { format, status, reason } = req.query;
  const query = { format, status, reason };

  const data = await reportService.getFullReport(runId, query, req.pagination);

  if (format === 'csv') {
    const csvString = exportToCsv(data.results);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="reconciliation-report-${runId}.csv"`);
    return res.status(200).send(csvString);
  }

  return sendResponse(res, 200, data, 'Full report retrieved successfully');
});

const getRunSummary = asyncHandler(async (req, res) => {
  const { runId } = req.params;
  const summary = await reportService.getRunSummary(runId);
  return sendResponse(res, 200, summary, 'Summary retrieved successfully');
});

const getUnmatched = asyncHandler(async (req, res) => {
  const { runId } = req.params;

  const data = await reportService.getUnmatched(runId, req.pagination);

  // Also support CSV export for unmatched specifically
  if (req.query.format === 'csv') {
    const csvString = exportToCsv(data.results);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="unmatched-report-${runId}.csv"`);
    return res.status(200).send(csvString);
  }

  return sendResponse(res, 200, data, 'Unmatched report retrieved successfully');
});

module.exports = {
  getFullReport,
  getRunSummary,
  getUnmatched,
};
