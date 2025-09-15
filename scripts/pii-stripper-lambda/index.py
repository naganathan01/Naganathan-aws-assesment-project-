import json
import gzip
import base64
import re
import boto3
from datetime import datetime

def lambda_handler(event, context):
    """
    Lambda function to strip PII from CloudWatch logs
    """
    
    # Decode the log data
    compressed_payload = base64.b64decode(event['awslogs']['data'])
    uncompressed_payload = gzip.decompress(compressed_payload)
    log_data = json.loads(uncompressed_payload)
    
    processed_events = []
    
    for log_event in log_data['logEvents']:
        message = log_event['message']
        
        # Strip PII patterns
        cleaned_message = strip_pii(message)
        
        processed_event = {
            'timestamp': log_event['timestamp'],
            'message': cleaned_message,
            'id': log_event['id']
        }
        
        processed_events.append(processed_event)
    
    # Store processed logs back to CloudWatch
    cloudwatch_logs = boto3.client('logs')
    
    try:
        cloudwatch_logs.put_log_events(
            logGroupName='/aws/lambda/processed-logs',
            logStreamName=f"processed-{datetime.now().strftime('%Y-%m-%d')}",
            logEvents=[
                {
                    'timestamp': event['timestamp'],
                    'message': event['message']
                }
                for event in processed_events
            ]
        )
    except Exception as e:
        print(f"Error writing to CloudWatch: {e}")
    
    return {
        'statusCode': 200,
        'body': json.dumps(f'Processed {len(processed_events)} log events')
    }

def strip_pii(message):
    """
    Remove common PII patterns from log messages
    """
    
    # Email addresses
    message = re.sub(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', '[EMAIL_REDACTED]', message)
    
    # Phone numbers (US format)
    message = re.sub(r'\b\d{3}[-.]?\d{3}[-.]?\d{4}\b', '[PHONE_REDACTED]', message)
    
    # Social Security Numbers
    message = re.sub(r'\b\d{3}-\d{2}-\d{4}\b', '[SSN_REDACTED]', message)
    
    # Credit card numbers (basic pattern)
    message = re.sub(r'\b(?:\d{4}[-\s]?){3}\d{4}\b', '[CARD_REDACTED]', message)
    
    # IP addresses
    message = re.sub(r'\b(?:\d{1,3}\.){3}\d{1,3}\b', '[IP_REDACTED]', message)
    
    return message