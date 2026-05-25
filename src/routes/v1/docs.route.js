const express = require('express');
const swaggerUi = require('swagger-ui-express');
const swaggerDef = require('../../docs/openapi');

const router = express.Router();

router.use('/', swaggerUi.serve);
router.get('/', swaggerUi.setup(swaggerDef, {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }'
}));

module.exports = router;
