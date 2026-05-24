const express = require('express');
const reconcileController = require('../../controllers/reconcile.controller');

const router = express.Router();

router.route('/').post(reconcileController.reconcile);

module.exports = router;
