const mongoose = require('mongoose');
const { parseCsvInBatches } = require('../utils/csvParser');
const { validateAndNormalizeRow } = require('../utils/validator');
const ReconciliationRun = require('../models/ReconciliationRun.model');
const UserTransaction = require('../models/UserTransaction.model');
const ExchangeTransaction = require('../models/ExchangeTransaction.model');
const DataQualityIssue = require('../models/DataQualityIssue.model');
const logger = require('../utils/logger');
const { globalConfig } = require('../config/reconciliation.config');

const processFile = async (runId, filePath, modelConfig) => {
  const { Model, sourceName, recordType } = modelConfig;
  
  let validCount = 0;
  let invalidCount = 0;
  let duplicateCount = 0;

  const processBatch = async (batch) => {
    const validRecords = [];
    const issueRecords = [];
    const transactionIds = new Set();

    for (const row of batch) {
      const { isValid, normalized, error, errorType } = validateAndNormalizeRow(row);

      if (!isValid) {
        issueRecords.push({
          reconciliationRunId: runId,
          recordType,
          source: sourceName,
          originalRow: row,
          issueType: errorType,
          severity: 'warning',
          description: error,
        });
        

        invalidCount++;
        continue;
      }


      if (transactionIds.has(normalized.normalizedTransactionId)) {
        duplicateCount++;
        issueRecords.push({
          reconciliationRunId: runId,
          recordType,
          source: sourceName,
          originalRow: row,
          issueType: 'duplicate_id',
          severity: 'warning',
          description: `Duplicate transaction ID in batch: ${normalized.normalizedTransactionId}`,
        });
        invalidCount++;
        continue;
      }
      transactionIds.add(normalized.normalizedTransactionId);

      validRecords.push({
        reconciliationRunId: runId,
        source: sourceName,
        originalRow: row,
        isValid: true,
        ...normalized,
      });
      validCount++;
    }


    if (validRecords.length > 0) {
      try {
        await Model.insertMany(validRecords, { ordered: false });
      } catch (err) {

      }
    }

    if (issueRecords.length > 0) {
      await DataQualityIssue.insertMany(issueRecords, { ordered: false });
    }
  };

  await parseCsvInBatches(filePath, globalConfig.maxBatchSize, processBatch, globalConfig.csvStreamBufferSize);

  return { validCount, invalidCount, duplicateCount };
};

const ingestFiles = async (userFilePath, exchangeFilePath) => {
  const runId = `RUN-${Date.now()}`;
  

  const run = await ReconciliationRun.create({
    runId,
    status: 'ingesting',
    startTime: new Date(),
    sources: ['userFile', 'exchangeFile']
  });

  try {
    logger.info(`Started ingestion for Run ID: ${runId}`);


    const userMetrics = await processFile(run._id, userFilePath, {
      Model: UserTransaction,
      sourceName: 'UserSystem',
      recordType: 'UserTransaction'
    });


    const exchangeMetrics = await processFile(run._id, exchangeFilePath, {
      Model: ExchangeTransaction,
      sourceName: 'ExchangeSystem',
      recordType: 'ExchangeTransaction'
    });


    run.summary = {
      totalUserTransactions: userMetrics.validCount + userMetrics.invalidCount,
      totalExchangeTransactions: exchangeMetrics.validCount + exchangeMetrics.invalidCount,
      totalDataQualityIssues: userMetrics.invalidCount + exchangeMetrics.invalidCount,
    };
    run.status = 'reconciling'; // Ready for next phase
    await run.save();

    logger.info(`Ingestion completed for Run ID: ${runId}`);

    return {
      runId: run.runId,
      status: run.status,
      metrics: {
        userFile: userMetrics,
        exchangeFile: exchangeMetrics
      }
    };
  } catch (error) {
    logger.error(`Ingestion failed for Run ID ${runId}: ${error.message}`);
    run.status = 'failed';
    run.errorMessage = error.message;
    run.endTime = new Date();
    await run.save();
    throw error;
  }
};

module.exports = {
  ingestFiles,
};
