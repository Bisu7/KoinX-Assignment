const request = require('supertest');
const app = require('../../src/app');

describe('Reconcile API', () => {
  it('should accept valid configuration overrides', async () => {
    const response = await request(app)
      .post('/api/v1/reconcile')
      .send({
        runName: 'API Test Run',
        timestampToleranceSeconds: 500,
        quantityTolerancePct: 0.05
      });

    // The execution should succeed and return 200
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('success');
    expect(response.body.data).toHaveProperty('runId');
    expect(response.body.data.summary).toBeDefined();
  });

  it('should reject invalid configuration bounds via Joi validation', async () => {
    const response = await request(app)
      .post('/api/v1/reconcile')
      .send({
        runName: 'Bad Config Run',
        timestampToleranceSeconds: -100 // Invalid negative tolerance
      });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe(400);
    expect(response.body.message).toMatch(/Invalid configuration/);
  });
});
