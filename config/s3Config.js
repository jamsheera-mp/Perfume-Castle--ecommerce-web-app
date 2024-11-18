
const { S3Client } = require('@aws-sdk/client-s3');

require('dotenv').config();

// Create S3 client
const s3Client = new S3Client({
    region: process.env.AWS_BUCKET_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    },
    requestHandler: new NodeHttpHandler({
        connectionTimeout: 10000,
        socketTimeout:10000,

    }),
    maxAttempts: 5
});

module.exports = { s3Client };