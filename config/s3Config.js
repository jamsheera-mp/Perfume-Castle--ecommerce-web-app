
const { S3Client } = require('@aws-sdk/client-s3');

const { NodeHttpHandler } = require('@smithy/node-http-handler');

require('dotenv').config();

// Create S3 client
const s3Client = new S3Client({
    region: process.env.AWS_BUCKET_REGION,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    },
    requestHandler: new NodeHttpHandler({
        connectionTimeout: 60000, //Increased to 60 seconds
        socketTimeout:60000,

    }),
    maxAttempts: 5
});

module.exports = { s3Client };