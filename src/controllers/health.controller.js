const asyncHandler = require('../utils/asyncHandler');
const { sendResponse } = require('../utils/apiResponse');

const checkHealth = asyncHandler(async (req, res) => {
  const healthData = {
    uptime: process.uptime(),
    message: 'OK',
    timestamp: Date.now(),
  };
  return sendResponse(res, 200, healthData, 'Server is healthy');
});

module.exports = {
  checkHealth,
};
