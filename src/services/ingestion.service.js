const mongoose = require('mongoose');
const { parseCsvInBatches } = require('../utils/csvParser');
const { validateAndNormalizeRow } = require('../utils/validator');
const ReconciliationRun = require('../models/ReconciliationRun.model');
const UserTransaction = require('../models/UserTransaction.model');
const ExchangeTransaction = require('../models/ExchangeTransaction.model');
const DataQualityIssue = require('../models/DataQualityIssue.model');
const logger = require('../utils/logger');

const BATCH_SIZE = 500;

/**
 * Processes a single CSV file
 */
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
        
        // Also save the malformed record with isValid=false if we want to retain it in main collection
        // Based on instructions, we "store invalid rows in DataQualityIssue collection",
        // optionally we can skip inserting into main table to keep strict types clean
        invalidCount++;
        continue;
      }

      // Check duplicate within the same batch memory
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

    // Insert batches into DB
    if (validRecords.length > 0) {
      try {
        await Model.insertMany(validRecords, { ordered: false });
      } catch (err) {
        // Handle potential DB level duplicates (E11000)
        logger.error(`Batch insert error for ${recordType}: ${err.message}`);
        // We could filter out the exact duplicates and retry, but ordered:false skips them
      }
    }

    if (issueRecords.length > 0) {
      await DataQualityIssue.insertMany(issueRecords, { ordered: false });
    }
  };

  await parseCsvInBatches(filePath, BATCH_SIZE, processBatch);

  return { validCount, invalidCount, duplicateCount };
};

/**
 * Main ingestion handler
 */
const ingestFiles = async (userFilePath, exchangeFilePath) => {
  const runId = `RUN-${Date.now()}`;
  
  // 1. Create Run Record
  const run = await ReconciliationRun.create({
    runId,
    status: 'ingesting',
    startTime: new Date(),
    sources: ['userFile', 'exchangeFile']
  });

  try {
    logger.info(`Started ingestion for Run ID: ${runId}`);

    // 2. Process User File
    const userMetrics = await processFile(run._id, userFilePath, {
      Model: UserTransaction,
      sourceName: 'UserSystem',
      recordType: 'UserTransaction'
    });

    // 3. Process Exchange File
    const exchangeMetrics = await processFile(run._id, exchangeFilePath, {
      Model: ExchangeTransaction,
      sourceName: 'ExchangeSystem',
      recordType: 'ExchangeTransaction'
    });

    // 4. Summarize and Update Run
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
