const mongoose = require('mongoose');
const UserTransaction = require('../../src/models/UserTransaction.model');
const ExchangeTransaction = require('../../src/models/ExchangeTransaction.model');
const ReconciliationResult = require('../../src/models/ReconciliationResult.model');
const { executeReconciliation } = require('../../src/services/reconciliation.service');

describe('Matching Engine Integration', () => {
  const config = {
    timestampToleranceSeconds: 300,
    quantityTolerancePct: 0.01,
    maxBatchSize: 500,
    matchScoreThreshold: 80,
  };

  afterEach(async () => {
    await UserTransaction.deleteMany({});
    await ExchangeTransaction.deleteMany({});
    await ReconciliationResult.deleteMany({});
  });

  it('should perfectly match 1-to-1 transactions', async () => {
    const runId = new mongoose.Types.ObjectId();

    await UserTransaction.create({
      reconciliationRunId: runId,
      normalizedTransactionId: 'USER-1',
      normalizedTimestamp: new Date('2023-01-01T12:00:00Z'),
      normalizedType: 'TRANSFER_OUT',
      normalizedAsset: 'BTC',
      normalizedAmount: '1.5',
      originalRow: { foo: 'bar' },
      source: 'testFile',
      isValid: true,
      status: 'pending'
    });

    await ExchangeTransaction.create({
      reconciliationRunId: runId,
      normalizedTransactionId: 'EXCH-1',
      normalizedTimestamp: new Date('2023-01-01T12:00:00Z'),
      normalizedType: 'TRANSFER_IN', // Maps correctly
      normalizedAsset: 'BTC',
      normalizedAmount: '1.5',
      originalRow: { foo: 'bar' },
      source: 'testFile',
      isValid: true,
      status: 'pending'
    });

    const result = await executeReconciliation('Test Run', config);
    
    expect(result.summary.totalMatched).toBe(1);
    expect(result.summary.totalUnmatchedUser).toBe(0);
    expect(result.summary.totalUnmatchedExchange).toBe(0);
    expect(result.summary.totalConflicting).toBe(0);
  });

  it('should flag conflict when duplicates tie for best score', async () => {
    const runId = new mongoose.Types.ObjectId();

    // 1 User transaction
    await UserTransaction.create({
      reconciliationRunId: runId,
      normalizedTransactionId: 'USER-2',
      normalizedTimestamp: new Date('2023-01-01T12:00:00Z'),
      normalizedType: 'BUY',
      normalizedAsset: 'ETH',
      normalizedAmount: '10',
      originalRow: { foo: 'bar' },
      source: 'testFile',
      isValid: true,
      status: 'pending'
    });

    // 2 Identical Exchange transactions
    await ExchangeTransaction.create([
      {
        reconciliationRunId: runId,
        normalizedTransactionId: 'EXCH-2A',
        normalizedTimestamp: new Date('2023-01-01T12:00:00Z'),
        normalizedType: 'BUY',
        normalizedAsset: 'ETH',
        normalizedAmount: '10',
        originalRow: { foo: 'bar' },
        source: 'testFile',
        isValid: true,
        status: 'pending'
      },
      {
        reconciliationRunId: runId,
        normalizedTransactionId: 'EXCH-2B',
        normalizedTimestamp: new Date('2023-01-01T12:00:00Z'),
        normalizedType: 'BUY',
        normalizedAsset: 'ETH',
        normalizedAmount: '10',
        originalRow: { foo: 'bar' },
        source: 'testFile',
        isValid: true,
        status: 'pending'
      }
    ]);

    const result = await executeReconciliation('Conflict Run', config);
    
    expect(result.summary.totalMatched).toBe(0);
    expect(result.summary.totalConflicting).toBe(1);
  });

  it('should leave unmatched transactions flagged appropriately', async () => {
    const runId = new mongoose.Types.ObjectId();

    await UserTransaction.create({
      reconciliationRunId: runId,
      normalizedTransactionId: 'USER-3',
      normalizedTimestamp: new Date('2023-01-01T12:00:00Z'),
      normalizedType: 'SELL',
      normalizedAsset: 'SOL',
      normalizedAmount: '50',
      originalRow: { foo: 'bar' },
      source: 'testFile',
      isValid: true,
      status: 'pending'
    });

    await ExchangeTransaction.create({
      reconciliationRunId: runId,
      normalizedTransactionId: 'EXCH-3',
      normalizedTimestamp: new Date('2023-01-01T12:00:00Z'),
      normalizedType: 'SELL',
      normalizedAsset: 'SOL',
      // Falls outside 1% tolerance -> unmatchable
      normalizedAmount: '52', 
      originalRow: { foo: 'bar' },
      source: 'testFile',
      isValid: true,
      status: 'pending'
    });

    const result = await executeReconciliation('Unmatched Run', config);
    
    expect(result.summary.totalMatched).toBe(0);
    expect(result.summary.totalUnmatchedUser).toBe(1);
    expect(result.summary.totalUnmatchedExchange).toBe(1);
  });
});
