// application/src/index.js - Updated with export for testing
const express = require('express');
const AWS = require('aws-sdk');
const winston = require('winston');
const promClient = require('prom-client');

// Initialize AWS SDK
AWS.config.update({ region: process.env.AWS_REGION || 'us-east-1' });
const ssm = new AWS.SSM();
const cloudwatch = new AWS.CloudWatch();

// Initialize Prometheus metrics
const register = new promClient.Registry();
promClient.collectDefaultMetrics({ register });

const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register]
});

const httpRequestTotal = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [register]
});

// Configure structured logging
const logger = winston.createLogger({
  format: winston.format.json(),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    })
  ]
});

const app = express();
app.use(express.json());

// Middleware for metrics collection
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    httpRequestDuration.labels(req.method, req.route?.path || req.url, res.statusCode).observe(duration);
    httpRequestTotal.labels(req.method, req.route?.path || req.url, res.statusCode).inc();
    
    // Send custom metrics to CloudWatch
    const params = {
      Namespace: 'HelloWorldApp',
      MetricData: [
        {
          MetricName: 'RequestLatency',
          Value: duration * 1000, // Convert to milliseconds
          Unit: 'Milliseconds',
          Timestamp: new Date(),
          Dimensions: [
            {
              Name: 'Endpoint',
              Value: req.url
            },
            {
              Name: 'Method',
              Value: req.method
            }
          ]
        }
      ]
    };
    
    cloudwatch.putMetricData(params, (err) => {
      if (err) logger.error('Failed to send metrics to CloudWatch', err);
    });
  });
  
  next();
});

// Function to get configuration from SSM Parameter Store
async function getConfig() {
  try {
    const params = {
      Names: [
        '/hello-world/db/connection_string',
        '/hello-world/redis/endpoint',
        '/hello-world/api/key'
      ],
      WithDecryption: true
    };
    
    const result = await ssm.getParameters(params).promise();
    const config = {};
    
    result.Parameters.forEach(param => {
      const key = param.Name.split('/').pop();
      config[key] = param.Value;
    });
    
    return config;
  } catch (error) {
    logger.error('Failed to retrieve configuration from SSM', error);
    return {};
  }
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Main endpoint
app.get('/', async (req, res) => {
  try {
    const config = await getConfig();
    logger.info('Request received', { 
      method: req.method, 
      url: req.url,
      headers: req.headers 
    });
    
    res.json({
      message: 'Hello World from AWS DevOps!',
      environment: process.env.ENVIRONMENT || 'development',
      version: process.env.APP_VERSION || '1.0.0',
      configLoaded: Object.keys(config).length > 0
    });
  } catch (error) {
    logger.error('Error processing request', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (error) {
    logger.error('Error generating metrics', error);
    res.status(500).end();
  }
});

// Error simulation endpoint (for testing monitoring)
app.get('/error', (req, res) => {
  logger.error('Simulated error occurred');
  res.status(500).json({ error: 'Simulated error for testing' });
});

const PORT = process.env.PORT || 3000;

// Don't start server during tests
if (process.env.NODE_ENV !== 'test') {
  const server = app.listen(PORT, () => {
    logger.info(`Server is running on port ${PORT}`);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    logger.info('SIGTERM signal received: closing HTTP server');
    server.close(() => {
      logger.info('HTTP server closed');
      process.exit(0);
    });
  });
}

// Export for testing
module.exports = { app };