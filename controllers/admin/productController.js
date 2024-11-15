
const Product = require('../../models/productSchema')
const Category = require('../../models/categorySchema')
const Brand = require('../../models/brandSchema')
const User = require('../../models/userSchema')
const fs = require('fs')
const path = require('path')
const sharp = require('sharp')
const { upload, uploadResizedImageToS3, deleteImageFromS3,getSignedImageUrl } = require('../../helpers/uploadToS3')

const productInfo = async (req, res) => {

    try {
        const category = await Category.find({ isListed: true })

        const brand = await Brand.find({ isBlocked: false })

        res.render('admin/addProducts', {
            cat: category,
            brand: brand
        })


    } catch (error) {
        console.log("product add errors", error);
        res.redirect('/admin/pageError')

    }
}
const addProducts = async (req, res) => {
    try {
        const products = req.body;
        console.log("Received products data:", products);
        console.log('Received files:', req.files)

        // Input validation
        const validationErrors = [];

        // Required fields check
        const requiredFields = ['productName', 'description', 'salePrice', 'quantity', 'ml', 'category'];
        for (const field of requiredFields) {
            if (!products[field]) {
                validationErrors.push(`${field} is required`);
            }
        }

        // Return if there are validation errors
        if (validationErrors.length > 0) {
            console.log('validation errors')
            return res.status(400).json({
                status: 'error',
                message: 'Validation failed',
                errors: validationErrors
            });
        }

        // Check if product exists
        const productExists = await Product.findOne({
            productName: products.productName,
        });
        if (productExists) {
            return res.status(400).json({
                status: 'error',
                message: 'Product already exists'
            });
        }

        // Process images
        const images = [];

        if (req.files && req.files.length > 0) {
            console.log(`Processing ${req.files.length} images...`);
            for (const file of req.files) {
                try {
                    console.log(`Processing image: ${file.originalname}`);
                    const uploadResult = await uploadResizedImageToS3(file.buffer, file.originalname);
                    const imageUrl = uploadResult.Location;
                    images.push(imageUrl);
                    console.log(`Successfully processed image: ${file.originalname}`);
                } catch (imageError) {
                    console.error(`Error processing image ${file.originalname}:`, imageError);
                    // Cleanup any uploaded images
                    for (const uploadedUrl of images) {
                        try {
                            const imageKey = uploadedUrl.split('/').slice(-2).join('/');
                            await deleteImageFromS3(imageKey);
                        } catch (deleteError) {
                            console.error('Error deleting uploaded image:', deleteError);
                        }
                    }
                    return res.status(400).json({
                        status: 'error',
                        message: 'Error processing product images'
                    });
                }
            }
        }

        // Find Category
        const categoryId = await Category.findOne({ name: products.category });
        console.log("category:", categoryId);

        if (!categoryId) {
            console.log("category not found");
            return res.status(400).json({ status: 'error', message: 'Category not found' });
        }

        let brandId = null;
        if (products.brand) {
            brandId = await Brand.findById(products.brand);
            if (!brandId) {
                console.log("brand not found");
                return res.status(400).json({ status: 'error', message: 'Brand not found' });
            }
        }


        // Create new product
        const newProduct = new Product({
            productName: products.productName.trim(),
            description: products.description.trim(),
            brand: brandId ? brandId._id : null,
            category: categoryId._id,
            salePrice: parseFloat(products.salePrice),
            quantity: parseInt(products.quantity),
            ml: Array.isArray(products.ml) ? products.ml : [parseInt(products.ml)],
            productImage: images,
            status: 'Available',
            dateAdded: new Date()
        });

        await newProduct.save();

        return res.status(200).json({ status: 'success', message: 'Product added successfully', imageCount: images.length });
    } catch (error) {
        console.error("Error saving product", error);
        return res.status(500).json({ status: 'error', message: 'Error saving product', error: error.message });
    }
};
const getAllProducts = async (req, res) => {
    try {

        const page = parseInt(req.query.page) || 1;
        const limit = 25;
        const skip = (page - 1) * limit;

        // Get total count of products for pagination
        const totalProducts = await Product.countDocuments({ isDeleted: false });
        const totalPages = Math.ceil(totalProducts / limit);

        // Fetch products with pagination
        const products = await Product.find({ isDeleted: false })
            .populate('category', 'name')
            .populate('brand', 'brandName')
            .skip(skip)
            .limit(limit)
            .sort({ createdAt: 1 }); // Sort by newest first

        // Generate signed URLs for each product's images
        const productsWithSignedUrls = await Promise.all(
            products.map(async (product) => {
                let categoryWarning = null;
                let brandWarning = null;

                // Generate signed URLs for each image
                const signedImageUrls = await Promise.all(
                    product.productImage.map(async (imageUrl) => {
                        // Extract the key from the full S3 URL if needed
                        const imageKey = imageUrl.split('/').slice(-2).join('/');
                        return await getSignedImageUrl(imageKey);
                    })
                );


                if (!product.category || !product.category.isListed) {
                    categoryWarning = 'Category unavailable';
                }
                if (!product.brand || product.brand.isBlocked) {
                    brandWarning = 'Brand unavailable';
                }
                return {
                    ...product.toObject(),
                    productImage:signedImageUrls,
                    categoryWarning,
                    brandWarning,
                };
            })
        );

        res.render('admin/products', {
            products: productsWithSignedUrls ,
            currentPage: page,
            totalPages,
            totalProducts,
            error: req.query.error || null
        });
    } catch (error) {
        console.log("product page loading errors:", error);
        return res.render('admin/products', {
            products: [],
            currentPage: 1,
            totalPages: 0,
            error: 'Failed to load products. Please try again.'
        });
        //res.redirect('/admin/pageError')
    }


}
const getEditProduct = async (req, res) => {
    try {
        const id = req.query.id
        const product = await Product.findOne({ _id: id })
        const categories = await Category.find({})
        const brand = await Brand.find({})
        // Generate signed URLs for each image
        const signedImageUrls = await Promise.all(
            product.productImage.map(async (imageUrl) => {
                // Extract the key from the full S3 URL if needed
                const imageKey = imageUrl.split('/').slice(-2).join('/');
                return await getSignedImageUrl(imageKey);
            })
        );

        res.render('admin/editProduct', {
            product: product,
            categories: categories,
            brand: brand
        })
    } catch (error) {
        console.log("edit product error", error);
        res.redirect('/admin/pageError')

    }
}
const editProduct = async (req, res) => {
    try {
        const id = req.params.id
        const data = req.body

        console.log('Product ID:', id);
        console.log('Request Body:', data);

        //Check if product exists
        const product = await Product.findById(id)
        if (!product) {
            console.log("product not found");
            //return res.status(404).json({error:"product not found"})
            return res.json({ status: 'error', message: 'Product Not Found' })

        }

        //Check for duplicate Product Name
        const existingProduct = await Product.findOne({
            productName: data.productName,
            _id: { $ne: id }
        })

        if (existingProduct) {
            //return res.status(400).json({error:'Product with this name already exists.Please try with another name'})
            return res.json({ status: 'error', message: 'Product with this name already exists.Please try with another name' })
        }

        //Find Category
        const categoryId = await Category.findById(data.category)
        if (!categoryId) {
            //return res.status(400).json({error:'Invalid category provided'})
            return res.json({ status: 'error', message: 'Invalid category provided' })
        }
        let brandId = null
        if (data.brand && data.brand.trim() !== '') {
            brandId = await Brand.findById(data.brand)
            if (!brandId) {
                console.log('brand not found');
                return res.json({ status: 'error', message: 'Invalid brand provided' })


            }
        }
        // Process new images
        let newImages = [];
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                try {
                    const uploadResult = await uploadResizedImageToS3(file.buffer, file.originalname);
                    const imageUrl = `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${uploadResult.Key}`;
                    newImages.push(imageUrl);
                } catch (imageError) {
                    console.error(`Error processing image ${file.originalname}:`, imageError);
                    return res.json({
                        status: 'error',
                        message: 'Error processing images'
                    });
                }
            }
        }

        // Handle image updates
        let finalImages = product.productImage;
        if (newImages.length > 0) {
            if (data.replaceImages === 'true') {
                // Delete existing images from S3
                for (const imageUrl of product.productImage) {
                    try {
                        const imageKey = imageUrl.split('/').slice(-2).join('/');
                        await deleteImageFromS3(imageKey);
                    } catch (error) {
                        console.error('Error deleting old image from S3:', error);
                    }
                }
                finalImages = newImages;
            } else {
                finalImages = [...product.productImage, ...newImages];
            }
        }



        // Update product
        const updatedProduct = await Product.findByIdAndUpdate(
            id,
            {
                productName: data.productName.trim(),
                description: data.description.trim(),
                brand: brandId ? brandId._id : null,
                category: categoryId._id,
                salePrice: parseFloat(data.salePrice),
                quantity: parseInt(data.quantity),
                ml: Array.isArray(data.ml) ? data.ml : [parseInt(data.ml)],
                productImage: finalImages
            },
            { new: true }
        );

        return res.json({
            status: 'success',
            message: 'Product updated successfully',
            product: updatedProduct
        });

    } catch (error) {
        console.log('product editing error', error);
        return res.json({ status: 'error', message: 'Error updating product' })


    }
}



const deleteSingleImage = async (req, res) => {
    try {
        const { imageToServer, productToServer } = req.body;

        // Extract the key from the S3 URL
        const imageKey = imageToServer.split('/').slice(-2).join('/'); // Gets "products/filename"

        // Delete from S3
        await deleteImageFromS3(imageKey);

        const product = await Product.findByIdAndUpdate(
            productToServer,
            { $pull: { productImage: imageToServer } },
            { new: true }
        );

        if (!product) {
            return res.status(404).json({ status: false, message: "Product not found" });
        }

        console.log(`Image ${imageToServer} deleted successfully`);
        res.json({ status: true, message: "Image deleted successfully" });


    } catch (error) {
        console.error('Image deleting error:', error);
        res.status(500).json({ status: false, message: "Server error while deleting image" });
    }
};


const deleteProduct = async (req, res) => {
    try {
        const id = req.params.id
        if (!id) {
            return res.status(400).redirect('/admin/pageError')
        }
        // Get product details before updating
        const product = await Product.findById(id);
        if (product) {
            // Delete all product images from S3
            for (const imageUrl of product.productImage) {
                try {
                    const imageKey = imageUrl.split('/').slice(-2).join('/'); // Gets "products/filename"
                    await deleteImageFromS3(imageKey);
                    console.log(`Successfully deleted image: ${imageKey} from S3`);
                } catch (error) {
                    console.error(`Error deleting image from S3: ${error}`);
                    // Continue with deletion even if S3 deletion fails
                }
            }
        }

        // Soft delete the product
        await Product.updateOne(
            { _id: id },
            {
                $set: {
                    isDeleted: true,
                    productImage: [] // Clear image array after S3 deletion
                }
            }
        );

        res.redirect('/admin/products');


    } catch (error) {
        console.log('error while soft deleting product', error);
        res.status(500).redirect('/admin/pageError')


    }
}
// Optional: Add a hard delete function if needed
const hardDeleteProduct = async (req, res) => {
    try {
        const id = req.params.id;

        // Get product details before deletion
        const product = await Product.findById(id);
        if (product) {
            // Delete all product images from S3
            for (const imageUrl of product.productImage) {
                try {
                    const imageKey = imageUrl.split('/').slice(-2).join('/');
                    await deleteImageFromS3(imageKey);
                    console.log(`Successfully deleted image: ${imageKey} from S3`);
                } catch (error) {
                    console.error(`Error deleting image from S3: ${error}`);
                }
            }
        }

        // Delete the product from database
        await Product.findByIdAndDelete(id);

        res.json({
            status: 'success',
            message: 'Product permanently deleted'
        });

    } catch (error) {
        console.error('Error in hard delete:', error);
        res.status(500).json({
            status: 'error',
            message: 'Error deleting product'
        });
    }
};

module.exports = {
    productInfo,
    addProducts,
    getAllProducts,
    getEditProduct,
    editProduct,
    deleteSingleImage,
    deleteProduct,
}
