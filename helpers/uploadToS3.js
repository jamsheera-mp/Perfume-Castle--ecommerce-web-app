

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
        fileSize: 25 * 1024 * 1024, // 25MB limit
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Not an image! Please upload an image.'), false);
        }
    }
});
async function compressImage(fileBuffer,quality=60) {
    try {
        // Get image metadata
        const metadata = await sharp(fileBuffer).metadata();
        
        // Calculate new dimensions while maintaining aspect ratio
        const MAX_DIMENSION = 1500;
        let width = metadata.width;
        let height = metadata.height;
        
        if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
            if (width > height) {
                height = Math.round((height * MAX_DIMENSION) / width);
                width = MAX_DIMENSION;
            } else {
                width = Math.round((width * MAX_DIMENSION) / height);
                height = MAX_DIMENSION;
            }
        }

        const compressedImage = await sharp(fileBuffer)
            .resize(width, height, {
                fit: 'inside',
                withoutEnlargement: true
            })
            .jpeg({ 
                quality: quality,
                mozjpeg: true,
                chromaSubsampling: '4:4:4'
            })
            .toBuffer();

        // If the compressed image is still too large, recursively compress with lower quality
        if (compressedImage.length > 5 * 1024 * 1024 && quality > 20) {
            return await compressImage(fileBuffer, quality - 10);
        }

        return compressedImage;
    } catch (error) {
        console.error('Image compression error:', error);
        throw error;
    }
}

// Function to process and upload image to S3
async function uploadResizedImageToS3(fileBuffer, originalname) {
    try {

         // Increase timeout for individual uploads
         const controller = new AbortController();
         const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 seconds
 
           // Compress image before upload
        const compressedBuffer = await compressImage(fileBuffer);
       

       // Generate unique filename
       const filename = `products/${Date.now()}-${originalname.replace(/\s+/g, '-')}`;

        // Create upload object with metadata
        const uploadParams = {
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: filename,
            Body: compressedBuffer,
            ContentType: 'image/jpeg',
            
            
        };

        const upload = new Upload({
            client: s3Client,
            params: uploadParams,
            abortController: controller,
            queueSize: 4,
            partSize: 5 * 1024 * 1024, // 5MB,
            leavePartsOnError: false
        });

        // Execute upload
        const result = await upload.done();
        clearTimeout(timeoutId)
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


