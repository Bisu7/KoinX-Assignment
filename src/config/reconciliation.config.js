const Joi = require('joi');

const envVarsSchema = Joi.object()
  .keys({
    TIMESTAMP_TOLERANCE_SECONDS: Joi.number().min(0).default(300),
    QUANTITY_TOLERANCE_PCT: Joi.number().min(0).max(1).default(0.01),
    MAX_BATCH_SIZE: Joi.number().integer().min(1).max(5000).default(500),
    MATCH_SCORE_THRESHOLD: Joi.number().min(0).max(100).default(80),
    CSV_STREAM_BUFFER_SIZE: Joi.number().integer().min(1).default(64),
  })
  .unknown();

const { value: envVars, error } = envVarsSchema.prefs({ errors: { label: 'key' } }).validate(process.env);

if (error) {
  throw new Error(`Config validation error: ${error.message}`);
}

const globalConfig = {
  timestampToleranceSeconds: envVars.TIMESTAMP_TOLERANCE_SECONDS,
  quantityTolerancePct: envVars.QUANTITY_TOLERANCE_PCT,
  maxBatchSize: envVars.MAX_BATCH_SIZE,
  matchScoreThreshold: envVars.MATCH_SCORE_THRESHOLD,
  csvStreamBufferSize: envVars.CSV_STREAM_BUFFER_SIZE,
};

const overrideSchema = Joi.object({
  timestampToleranceSeconds: Joi.number().min(0).optional(),
  quantityTolerancePct: Joi.number().min(0).max(1).optional(),
  maxBatchSize: Joi.number().integer().min(1).max(5000).optional(),
  matchScoreThreshold: Joi.number().min(0).max(100).optional(),
  csvStreamBufferSize: Joi.number().integer().min(1).optional(),
});

const getMergedConfig = (runtimeOverrides = {}) => {
  const { value, error } = overrideSchema.validate(runtimeOverrides);
  if (error) {
    throw new Error(`Invalid configuration override: ${error.details[0].message}`);
  }

  return { ...globalConfig, ...value };
};

module.exports = {
  globalConfig,
  getMergedConfig,
};
