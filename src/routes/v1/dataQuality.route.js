const express = require('express');
const dataQualityController = require('../../controllers/dataQuality.controller');
const { paginate } = require('../../middlewares/pagination.middleware');

const router = express.Router();

router.route('/issues').get(paginate, dataQualityController.getIssues);
router.route('/summary').get(dataQualityController.getSummaryMetrics);

module.exports = router;
