const express = require('express');
const AWS = require('aws-sdk');
const app = express();
const port = process.env.PORT || 3000;

// Initialize AWS SDK
const ssm = new AWS.SSM({
  region: process.env.AWS_REGION || 'us-west-2'
});

app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION || '1.0.0'
  });
});

// Main endpoint
app.get('/', async (req, res) => {
  try {
    // Get configuration from SSM Parameter Store
    const params = {
      Name: '/app/message',
      WithDecryption: true
    };
    
    const result = await ssm.getParameter(params).promise();
    const message = result.Parameter.Value;
    
    res.json({
      message: message,
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString(),
      hostname: require('os').hostname()
    });
  } catch (error) {
    console.error('Error fetching parameter:', error);
    res.status(500).json({
      error: 'Failed to fetch configuration',
      message: 'Hello World - Default Message'
    });
  }
});

// Metrics endpoint for monitoring
app.get('/metrics', (req, res) => {
  res.set('Content-Type', 'text/plain');
  res.send(`
# HELP http_requests_total Total HTTP requests
# TYPE http_requests_total counter
http_requests_total 1

# HELP app_version Application version
# TYPE app_version gauge
app_version{version="${process.env.APP_VERSION || '1.0.0'}"} 1
`);
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

module.exports = app;