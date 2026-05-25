const swaggerDef = {
  openapi: '3.0.0',
  info: {
    title: 'KoinX Crypto Transaction Reconciliation Engine API',
    version: '1.0.0',
    description: 'API documentation for the Crypto Reconciliation Engine (Phase 11)',
    license: {
      name: 'MIT',
    },
  },
  servers: [
    {
      url: 'http://localhost:5000/api/v1',
      description: 'Development Server',
    },
  ],
  components: {
    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Placeholder for JWT authentication. Provide a token to access secured endpoints in the future.',
      },
    },
    schemas: {
      ApiError: {
        type: 'object',
        properties: {
          code: {
            type: 'integer',
            example: 400,
          },
          message: {
            type: 'string',
            example: 'Invalid configuration values provided',
          },
        },
      },
      ApiResponse: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            example: 'success',
          },
          message: {
            type: 'string',
            example: 'Operation successful',
          },
          data: {
            type: 'object',
          },
        },
      },
      ReconciliationConfig: {
        type: 'object',
        properties: {
          runName: {
            type: 'string',
            example: 'May 2026 Audit',
          },
          timestampToleranceSeconds: {
            type: 'integer',
            example: 300,
          },
          quantityTolerancePct: {
            type: 'number',
            format: 'float',
            example: 0.01,
          },
        },
      },
    },
  },
  security: [
    {
      BearerAuth: [],
    },
  ],
  paths: {
    '/health': {
      get: {
        summary: 'Check API Health',
        description: 'Returns the operational status of the server.',
        tags: ['Health'],
        responses: {
          200: {
            description: 'Server is healthy',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ApiResponse',
                },
              },
            },
          },
        },
      },
    },
    '/upload': {
      post: {
        summary: 'Upload User and Exchange CSVs',
        description: 'Ingest both user and exchange transaction CSVs in a single multipart form request.',
        tags: ['Ingestion'],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['userFile', 'exchangeFile'],
                properties: {
                  userFile: {
                    type: 'string',
                    format: 'binary',
                    description: 'The user_transactions.csv file',
                  },
                  exchangeFile: {
                    type: 'string',
                    format: 'binary',
                    description: 'The exchange_transactions.csv file',
                  },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Files parsed and ingested successfully',
          },
          400: {
            description: 'Bad Request (missing files or unsupported format)',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ApiError',
                },
              },
            },
          },
        },
      },
    },
    '/reconcile': {
      post: {
        summary: 'Execute Reconciliation Engine',
        description: 'Triggers the fuzzy matching algorithm on all pending transactions.',
        tags: ['Reconciliation'],
        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ReconciliationConfig',
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Reconciliation run completed',
          },
          400: {
            description: 'Invalid config payload',
          },
        },
      },
    },
    '/report/{runId}/summary': {
      get: {
        summary: 'Get Run Summary Metrics',
        description: 'Retrieves aggregated statistics for a specific reconciliation run.',
        tags: ['Reporting'],
        parameters: [
          {
            in: 'path',
            name: 'runId',
            required: true,
            schema: {
              type: 'string',
            },
            description: 'The unique REC-... run ID string',
          },
        ],
        responses: {
          200: {
            description: 'Summary dashboard data',
          },
          404: {
            description: 'Run ID not found',
          },
        },
      },
    },
    '/report/{runId}': {
      get: {
        summary: 'Get Full Ledger Report',
        description: 'Retrieves the detailed mapped/unmapped ledger for a run. Supports pagination, filtering, and CSV download.',
        tags: ['Reporting'],
        parameters: [
          {
            in: 'path',
            name: 'runId',
            required: true,
            schema: { type: 'string' },
          },
          {
            in: 'query',
            name: 'status',
            schema: { type: 'string', enum: ['matched', 'unmatched_user', 'unmatched_exchange', 'conflicting'] },
            required: false,
          },
          {
            in: 'query',
            name: 'page',
            schema: { type: 'integer', default: 1 },
            required: false,
          },
          {
            in: 'query',
            name: 'limit',
            schema: { type: 'integer', default: 50 },
            required: false,
          },
          {
            in: 'query',
            name: 'format',
            schema: { type: 'string', enum: ['csv', 'json'] },
            required: false,
            description: 'Set to "csv" to trigger an instant file download',
          },
        ],
        responses: {
          200: {
            description: 'Ledger records',
          },
        },
      },
    },
    '/report/{runId}/unmatched': {
      get: {
        summary: 'Get Unmatched Records',
        description: 'Retrieves only the orphaned rows from both the user and exchange sides.',
        tags: ['Reporting'],
        parameters: [
          {
            in: 'path',
            name: 'runId',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          200: {
            description: 'Unmatched ledger rows',
          },
        },
      },
    },
    '/data-quality/summary': {
      get: {
        summary: 'Data Quality Summary',
        description: 'Returns aggregated ingestion failure metrics.',
        tags: ['Data Quality'],
        responses: {
          200: {
            description: 'Data Quality metrics',
          },
        },
      },
    },
    '/data-quality/issues': {
      get: {
        summary: 'Raw Data Quality Issues',
        description: 'Retrieves the exact messy/corrupt rows that failed validation.',
        tags: ['Data Quality'],
        parameters: [
          {
            in: 'query',
            name: 'page',
            schema: { type: 'integer', default: 1 },
            required: false,
          },
        ],
        responses: {
          200: {
            description: 'List of DataQualityIssue records',
          },
        },
      },
    },
  },
};

module.exports = swaggerDef;
