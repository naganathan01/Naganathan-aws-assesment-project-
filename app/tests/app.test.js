// application/tests/app.test.js
const request = require('supertest');
const express = require('express');

// Mock AWS SDK
jest.mock('aws-sdk', () => {
  const mockSSM = {
    getParameters: jest.fn().mockReturnThis(),
    promise: jest.fn().mockResolvedValue({
      Parameters: [
        { Name: '/hello-world/db/connection_string', Value: 'mock-db-connection' },
        { Name: '/hello-world/redis/endpoint', Value: 'mock-redis-endpoint' },
        { Name: '/hello-world/api/key', Value: 'mock-api-key' }
      ]
    })
  };
  
  const mockCloudWatch = {
    putMetricData: jest.fn((params, callback) => callback(null, {}))
  };

  return {
    SSM: jest.fn(() => mockSSM),
    CloudWatch: jest.fn(() => mockCloudWatch),
    config: {
      update: jest.fn()
    }
  };
});

describe('Hello World Application', () => {
  let app;

  beforeEach(() => {
    // Clear module cache to get fresh app instance
    jest.resetModules();
    const appModule = require('../src/index.js');
    app = appModule.app;
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
    });
  });

  describe('GET /', () => {
    it('should return hello world message', async () => {
      const response = await request(app)
        .get('/')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Hello World from AWS DevOps!');
      expect(response.body).toHaveProperty('environment');
      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('configLoaded', true);
    });
  });

  describe('GET /metrics', () => {
    it('should return Prometheus metrics', async () => {
      const response = await request(app)
        .get('/metrics')
        .expect(200);

      expect(response.text).toContain('# HELP');
      expect(response.text).toContain('# TYPE');
    });
  });

  describe('GET /error', () => {
    it('should return 500 error for testing', async () => {
      const response = await request(app)
        .get('/error')
        .expect('Content-Type', /json/)
        .expect(500);

      expect(response.body).toHaveProperty('error', 'Simulated error for testing');
    });
  });
});



