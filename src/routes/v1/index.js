const express = require('express');
const healthRoute = require('./health.route');
const uploadRoute = require('./upload.route');
const reconcileRoute = require('./reconcile.route');
const reportRoute = require('./report.route');
const dataQualityRoute = require('./dataQuality.route');
const docsRoute = require('./docs.route');

const router = express.Router();

const defaultRoutes = [
  {
    path: '/health',
    route: healthRoute,
  },
  {
    path: '/upload',
    route: uploadRoute,
  },
  {
    path: '/reconcile',
    route: reconcileRoute,
  },
  {
    path: '/report',
    route: reportRoute,
  },
  {
    path: '/data-quality',
    route: dataQualityRoute,
  },
  {
    path: '/docs',
    route: docsRoute,
  },
];

defaultRoutes.forEach((route) => {
  router.use(route.path, route.route);
});

module.exports = router;
