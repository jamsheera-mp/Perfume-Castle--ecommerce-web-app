

// utils/uploadToS3.js
const multer = require('multer');
const sharp = require('sharp');
const { s3Client } = require('../config/s3Config');
const { Upload } = require('@aws-sdk/lib-storage');
const { DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

// Configure multer to store files in memory
const storage = multer.memoryStorage();

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Not an image! Please upload an image.'), false);
        }
    }
});

// Function to process and upload image to S3
async function uploadResizedImageToS3(fileBuffer, originalname) {
    try {
         // Process image with sharp
         const processedImage = await sharp(fileBuffer)
         .resize(440, 440, {
             fit: 'cover',
             withoutEnlargement: true
         })
         .jpeg({ quality: 80 });
            
         // Get the processed buffer and metadata
        const resizedBuffer = await processedImage.toBuffer();
        const metadata = await processedImage.metadata();

        // Generate unique filename
        const filename = `products/${Date.now()}-${originalname}`;

        // Create upload object with metadata
        const uploadParams = {
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: filename,
            Body: resizedBuffer,
            ContentType: 'image/jpeg',
            ContentLength: metadata.size,
            CacheControl:'max-age=31536000',//cache for 1 year
            Metadata:{
                'original-filename':originalname,
                'width': metadata.width.toString(),
                'height': metadata.height.toString(),
            }
        };

        const upload = new Upload({
            client: s3Client,
            params: uploadParams
        });

        // Execute upload
        const result = await upload.done();
        return result;
    } catch (error) {
        console.error('Error in uploadResizedImageToS3:', error);
        throw error;
    }
}
// Function to generate signed URL for private S3 objects
async function getSignedImageUrl(key) {
    try {
        const command = new GetObjectCommand({
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: key
        });

        // Generate signed URL that expires in 1 hour
        const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
        return signedUrl;
    } catch (error) {
        console.error('Error generating signed URL:', error);
        throw error;
    }
}
// Function to delete image from S3
async function deleteImageFromS3(key) {
    try {
        const deleteCommand = new DeleteObjectCommand({
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: key
        });

        const result = await s3Client.send(deleteCommand);
        return result;
    } catch (error) {
        console.error('Error in deleteImageFromS3:', error);
        throw error;
    }
}

module.exports = {
    upload,
    uploadResizedImageToS3,
    getSignedImageUrl,
    deleteImageFromS3
};


