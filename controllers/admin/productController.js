
const Product = require('../../models/productSchema')
const Category = require('../../models/categorySchema')
const Brand  = require('../../models/brandSchema')
const User = require('../../models/userSchema')
const fs = require('fs')
const path = require('path')
const sharp = require('sharp')

const productInfo = async(req,res)=>{

    try {
        const category = await Category.find({isListed:true})
        const brand = await Brand.find({isBlocked:false})
       
        res.render('admin/addProducts',{
            cat:category,
            brand:brand
        })


    } catch (error) {
        console.log("product add errors",error);
        res.redirect('/admin/pageError')
        
    }
}
const addProducts = async (req, res) => {
    try {
        const products = req.body;
        console.log("Received products data:", products);

        // Input validation
        const validationErrors = [];
        
        // Required fields check
        const requiredFields = ['productName', 'description', 'regularPrice', 'salePrice', 'quantity', 'ml', 'category'];
        for (const field of requiredFields) {
            if (!products[field]) {
                validationErrors.push(`${field} is required`);
            }
        }

        // Return if there are validation errors
        if (validationErrors.length > 0) {
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
            for (const file of req.files) {
                try {
                    const originalImagePath = file.path;
                    const resizedImagePath = path.join('public', 'uploads', 'product-images', file.filename);
                    
                    await sharp(originalImagePath)
                        .resize({ width: 440, fit: 'cover' })
                        .toFile(resizedImagePath);
                    
                    images.push(file.filename);
                } catch (imageError) {
                    console.error("Error processing image:", imageError);
                    return res.status(400).json({
                        status: 'error',
                        message: 'Error processing product images'
                    });
                }
            }
        }

        // Find Category
        const categoryId = await Category.findOne({name: products.category});
        console.log("category:", categoryId);
        
        if (!categoryId) {
            console.log("category not found");
            return res.status(400).json({status: 'error', message: 'Category not found'});
        }

        let brandId = null;
        if (products.brand) {
            brandId = await Brand.findById(products.brand);
            if (!brandId) {
                console.log("brand not found");
                return res.status(400).json({status: 'error', message: 'Brand not found'});
            }
        }
        

        // Create new product
        const newProduct = new Product({
            productName: products.productName.trim(),
            description: products.description.trim(),
            brand: brandId ? brandId._id : null,
            category: categoryId._id,
            regularPrice: parseFloat(products.regularPrice),
            productOffer: parseFloat(products.productOffer || 0),
            salePrice: parseFloat(products.salePrice),
            createdOn: new Date(),
            quantity: parseInt(products.quantity),
            ml: products.ml,
            productImage: images,
            status: 'Available'
        });

        await newProduct.save();
        console.log("New Product Saved", newProduct);
        
        return res.status(200).json({status: 'success', message: 'Product added successfully'});
    } catch (error) {
        console.error("Error saving product", error);
        return res.status(500).json({status: 'error', message: 'Error saving product', error: error.message});
    }
};
const getAllProducts = async (req,res) => {
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

        res.render('admin/products', {
            products,
            currentPage: page,
            totalPages,
            totalProducts,
            
        });
    } catch (error) {
        console.log("product page loading errors:",error);
        
        res.redirect('/admin/pageError')
    }
   
    
}
const getEditProduct = async(req,res)=>{
    try {
        const id = req.query.id
        const product = await Product.findOne({_id:id})
        const categories = await Category.find({})
        const brand = await Brand.find({})
        res.render('admin/editProduct',{
            product:product,
            categories:categories,
            brand:brand
        })
    } catch (error) {
        console.log("edit product error",error);
        res.redirect('/admin/pageError')
        
    }
}
const editProduct = async (req,res)=>{
    try {
        const id = req.params.id
        const data = req.body
        
        console.log('Product ID:', id);
        console.log('Request Body:', data);

        //Check if product exists
        const product = await Product.findById(id)
        if(!product){
            console.log("product not found");
            //return res.status(404).json({error:"product not found"})
            return res.json({status:'error',message:'Product Not Found'})

        }

        //Check for duplicate Product Name
        const existingProduct = await Product.findOne({
            productName:data.productName,
            _id:{$ne:id}
        })

        if(existingProduct){
            //return res.status(400).json({error:'Product with this name already exists.Please try with another name'})
            return res.json({status:'error',message:'Product with this name already exists.Please try with another name'})
        }

        //Find Category
        const categoryId = await Category.findById(data.category)
        if(!categoryId){
            //return res.status(400).json({error:'Invalid category provided'})
            return res.json({status:'error',message:'Invalid category provided'})
        }
        let brandId = null
        if(data.brand && data.brand.trim() !== ''){
            brandId = await Brand.findById(data.brand)
            if(!brandId){
                console.log('brand not found');
                return  res.json({status:'error',message:'Invalid brand provided'})

                
            }
        }
        // Process new images if uploaded
        let newImages = [];
        if (req.files && req.files.length > 0) {
            for (let i = 0; i < req.files.length; i++) {
                const originalImagePath = req.files[i].path;
                const resizedImagePath = path.join('public', 'uploads', 'product-images', req.files[i].filename);
                
                await sharp(originalImagePath)
                    .resize({ width: 440, fit: 'cover' })
                    .toFile(resizedImagePath);
                newImages.push(req.files[i].filename);
            }
        }

        
        //Process new Images if uploaded
        //const images =[]
        //if(req.files && req.files.length > 0){
            //for(let i=0;i<req.files.length;i++){
                //images.push(req.files[i].filename)
            //}
        //}
        //Prepare updated fields
        const updatedFields = {
            productName:data.productName,
            description:data.description,
            brand:brandId ? brandId._id : null,
            category:categoryId._id,
            offer:data.productOffer,
            regularPrice:data.regularPrice,
            salePrice:data.salePrice,
            quantity:data.quantity,
            ml:data.ml,

        }
         // Handle image updates
         if (newImages.length > 0) {
            if (data.replaceImages === 'true') {
                // Replace all images
                updatedFields.productImage = newImages;
            } else {
                // Append new images to existing ones
                updatedFields.productImage = [...product.productImage, ...newImages];
            }
        }
        //if(req.files.length > 0){
           // updatedFields.$push = {productImage:{$each:images}}
        //}

        //update the product
        const editedProduct = await Product.findByIdAndUpdate(id,updatedFields,{new:true})
        console.log('Product ID:', id);
        console.log('edited product:', editedProduct);
        return res.json({status:'success',message:'Product updated successfully',product:editedProduct})
        //res.redirect('/admin/products')
    } catch (error) {
        console.log('product editing error',error);
        return res.json({status:'error',message:'Error updating product'})
        //res.redirect('/admin/pageError')
        
    }
}


const getAllProductsGrid = async (req, res) => {
    try {
        const search = req.query.search || "";
        const page = req.query.page || 1;
        const limit = 25;
        const skip = (page - 1) * limit;


         
        const brandSearch = await Brand.find({
            name: { $regex: new RegExp(".*" + search + ".*", 'i') },
            isBlocked: false
        }).select('_id')
        const brandIds = brandSearch.map(brand => brand._id)

        const productData = await Product.find({
            $or: [
                { productName: { $regex: new RegExp(".*" + search + ".*", 'i') } },
                { brand: { $in:brandIds } }
            ]
        })
        .limit(limit)
        .skip(skip)
        .populate('category')
        .exec();


    
        const count = await Product.find({
            $or: [
                { productName: { $regex: new RegExp(".*" + search + ".*", 'i') } },
                { brand: { $in:brandIds } }
            ]
        }).countDocuments();

        const category = await Category.find({ isListed: true });
        const brand = await Brand.find({ isBlocked: false });

        if (category && brand) {
            res.render('admin/productGridView', {
                products: productData,
                currentPage: page,
                totalPages: Math.ceil(count / limit),
                cat: category,
                brand: brand,
                
            });
        } else {
            console.log("Product page loading errors:", error);
            res.render('admin/pageError');
        }
    } catch (error) {
        console.log("Product page loading errors:", error);
        res.redirect('/admin/pageError');
    }
}

const deleteSingleImage = async (req, res) => {
    try {
        const { imageToServer, productToServer } = req.body;
        const product = await Product.findByIdAndUpdate(
            productToServer,
            { $pull: { productImage: imageToServer } },
            { new: true }
        );

        if (!product) {
            return res.status(404).json({ status: false, message: "Product not found" });
        }

        const imagePath = path.join(__dirname, '..', '..', 'public', 'uploads', 're-image', imageToServer);
        console.log("Request body:", req.body);
        console.log("Image to delete:", imageToServer);
        console.log("Product ID:", productToServer);
        console.log("Image path:", imagePath); 
        console.log("Absolute image path:", path.resolve(imagePath));

        
        if (fs.existsSync(imagePath)) {
            await fs.promises.unlink(imagePath);
            console.log(`Image ${imageToServer} deleted successfully`);
            res.json({ status: true, message: "Image deleted successfully" });
        } else {
            console.log(`Image ${imageToServer} not found`);
            res.status(404).json({ status: false, message: "Image file not found" });
        }
    } catch (error) {
        console.error('Image deleting error:', error);
        res.status(500).json({ status: false, message: "Server error while deleting image" });
    }
};

const deleteProduct = async(req,res)=>{
    try {
        const id = req.params.id
        const product = await Product.findByIdAndDelete(id)
        console.log('deleted product',product);
        
        if(product){
            res.redirect('/admin/products')
        }

        
    } catch (error) {
        
        console.log('error deleting product',error);
        
    }
}
const softDeleteProduct = async(req,res)=>{
    try {
        const id = req.params.id
        if(!id){
            return res.status(400).redirect('/admin/pageError')
        }
        await  Product.updateOne({_id:id},{$set:{isDeleted:true}})
        res.redirect('/admin/products')

    } catch (error) {
        console.log('error while soft deleting product',error);
        res.status(500).redirect('/admin/pageError')
        
        
    }
}
module.exports = {
    productInfo,
    addProducts,
    getAllProducts,
    getAllProductsGrid,
    getEditProduct,
    editProduct,
    deleteSingleImage,
    
    deleteProduct,
    softDeleteProduct
}
