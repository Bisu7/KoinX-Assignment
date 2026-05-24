const express = require('express');
const uploadController = require('../../controllers/upload.controller');
const upload = require('../../middlewares/upload.middleware');

const router = express.Router();

router.route('/').post(
  upload.fields([
    { name: 'userFile', maxCount: 1 },
    { name: 'exchangeFile', maxCount: 1 },
  ]),
  uploadController.uploadCsvs
);

module.exports = router;
