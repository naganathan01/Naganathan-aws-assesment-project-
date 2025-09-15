const AWS = require('aws-sdk');
const https = require('https');
const url = require('url');

const ec2 = new AWS.EC2();
const eks = new AWS.EKS();

exports.handler = async (event) => {
    console.log('Received event:', JSON.stringify(event, null, 2));
    
    try {
        // Parse SNS message
        const message = JSON.parse(event.Records[0].Sns.Message);
        const alarmName = message.AlarmName;
        const newState = message.NewStateValue;
        
        // Get infrastructure info using Gemini
        const infraInfo = await getInfrastructureInfo();
        const geminiResponse = await queryGemini(`Alarm ${alarmName} is in ${newState} state. Current infrastructure: ${infraInfo}. Provide recommendations.`);
        
        // Send to Slack
        await sendToSlack({
            text: `🚨 Infrastructure Alert`,
            attachments: [
                {
                    color: newState === 'ALARM' ? 'danger' : 'good',
                    fields: [
                        {
                            title: 'Alarm Name',
                            value: alarmName,
                            short: true
                        },
                        {
                            title: 'State',
                            value: newState,
                            short: true
                        },
                        {
                            title: 'Gemini Recommendations',
                            value: geminiResponse,
                            short: false
                        }
                    ]
                }
            ]
        });
        
        return { statusCode: 200, body: 'Success' };
    } catch (error) {
        console.error('Error:', error);
        return { statusCode: 500, body: 'Error' };
    }
};

async function getInfrastructureInfo() {
    try {
        // Get VPC info
        const vpcs = await ec2.describeVpcs().promise();
        
        // Get subnets
        const subnets = await ec2.describeSubnets().promise();
        const publicSubnets = subnets.Subnets.filter(s => 
            s.Tags && s.Tags.find(t => t.Key === 'Type' && t.Value === 'public')
        );
        
        // Get EKS clusters
        const clusters = await eks.listClusters().promise();
        
        return JSON.stringify({
            vpcs: vpcs.Vpcs.length,
            publicSubnets: publicSubnets.length,
            totalSubnets: subnets.Subnets.length,
            eksClusters: clusters.clusters.length
        });
    } catch (error) {
        console.error('Error getting infrastructure info:', error);
        return 'Error retrieving infrastructure information';
    }
}

async function queryGemini(prompt) {
    return new Promise((resolve, reject) => {
        // Mock Gemini response for demo
        // In production, you would call the actual Gemini API
        const mockResponse = `Based on the alarm and infrastructure analysis:
        
1. Check EKS node health and scaling policies
2. Verify RDS connection pool settings
3. Review application logs for errors
4. Consider scaling resources if needed
5. Monitor for any security events in GuardDuty`;
        
        setTimeout(() => resolve(mockResponse), 100);
    });
}

async function sendToSlack(payload) {
    return new Promise((resolve, reject) => {
        const slackUrl = process.env.SLACK_WEBHOOK_URL;
        const parsedUrl = url.parse(slackUrl);
        
        const postData = JSON.stringify(payload);
        
        const options = {
            hostname: parsedUrl.hostname,
            port: 443,
            path: parsedUrl.path,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };
        
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                resolve(data);
            });
        });
        
        req.on('error', (error) => {
            reject(error);
        });
        
        req.write(postData);
        req.end();
    });
}