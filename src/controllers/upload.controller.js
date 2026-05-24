const asyncHandler = require('../utils/asyncHandler');
const { sendResponse } = require('../utils/apiResponse');
const ApiError = require('../utils/apiError');
const ingestionService = require('../services/ingestion.service');
const fs = require('fs');

const uploadCsvs = asyncHandler(async (req, res) => {
  if (!req.files || !req.files['userFile'] || !req.files['exchangeFile']) {
    throw new ApiError(400, 'Both userFile and exchangeFile must be uploaded');
  }

  const userFilePath = req.files['userFile'][0].path;
  const exchangeFilePath = req.files['exchangeFile'][0].path;

  try {
    const result = await ingestionService.ingestFiles(userFilePath, exchangeFilePath);
    
    // Clean up uploaded files after ingestion
    fs.unlinkSync(userFilePath);
    fs.unlinkSync(exchangeFilePath);

    return sendResponse(res, 200, result, 'Files ingested successfully');
  } catch (error) {
    // Attempt cleanup on failure
    if (fs.existsSync(userFilePath)) fs.unlinkSync(userFilePath);
    if (fs.existsSync(exchangeFilePath)) fs.unlinkSync(exchangeFilePath);
    throw error;
  }
});

module.exports = {
  uploadCsvs,
};
