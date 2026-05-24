const express = require('express');
const reportController = require('../../controllers/report.controller');
const { paginate } = require('../../middlewares/pagination.middleware');

const router = express.Router();

router.route('/:runId').get(paginate, reportController.getFullReport);
router.route('/:runId/summary').get(reportController.getRunSummary);
router.route('/:runId/unmatched').get(paginate, reportController.getUnmatched);

module.exports = router;
