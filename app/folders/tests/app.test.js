const request = require('supertest');
const app = require('../src/index');

describe('Hello World App', () => {
  test('Health endpoint should return 200', async () => {
    const response = await request(app)
      .get('/health')
      .expect(200);
    
    expect(response.body.status).toBe('healthy');
  });

  test('Metrics endpoint should return metrics', async () => {
    const response = await request(app)
      .get('/metrics')
      .expect(200);
    
    expect(response.text).toContain('http_requests_total');
  });
});