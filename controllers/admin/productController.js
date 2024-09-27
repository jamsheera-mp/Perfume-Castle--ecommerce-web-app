
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
const addProducts = async(req,res)=>{
    try {
        const products = req.body
        console.log("products:",products);
        const productExists = await Product.findOne({
            productName:products.productName,
        })
        if(!productExists){
            const images = []
            if(req.files && req.files.length > 0){
                for(let i=0;i<req.files.length;i++){
                    const originalImagePath = req.files[i].path
                    const resizedImagePath = path.join('public','uploads','product-images',req.files[i].filename)
                    
                    await sharp(originalImagePath)
                    .resize({width:440,fit:'cover'})
                    .toFile(resizedImagePath)
                    images.push(req.files[i].filename)
                }
            }
            const categoryId = await Category.findOne({name:products.category})
            console.log("category:",categoryId);
            
            if(!categoryId){
                console.log("category not found");
                
                return res.status(400).json({message:"Category not found"})
            }
            const newProduct = new Product({
                productName :products.productTitle,
                description:products.description,
                brand:products.brand,
                category:categoryId._id,
                regularPrice:products.regularPrice,
                productOffer:products.productOffer,
                salePrice:products.salePrice,
                createdOn:new Date(),
                quantity:products.quantity,
                ml:products.ml,
                productImage:images,
               status:'Available'


            })
            await newProduct.save()
            console.log(newProduct);
            
            return res.redirect('/admin/addProducts')
        }else{
            return res.status(400).json({message:"Product already exists"})
        }
    } catch (error) {
        console.log("Error saving product",error);
        return res.redirect('/admin/pageError')
        
    }
}
const getAllProducts = async (req,res) => {
    try {
        const search = req.query.search || ""
        const page = req.query.page || 1
        const limit = 25
        const  skip = (page - 1) * limit
        const productData = await Product.find({
            $or:[ 
                {productName:{$regex:new RegExp(".*"+search+".*",'i')}},
                {brand:{$regex:new RegExp(".*"+search+".*",'i')}}

            ]
        }).limit(limit*1).skip(skip).populate('category').exec()

        const count = await Product.find({
            $or:[ 
                {productName:{$regex:new RegExp(".*"+search+".*",'i')}},
                {brand:{$regex:new RegExp(".*"+search+".*",'i')}}

            ]
        }).countDocuments()

       const category = await Category.find({isListed:true})
       const brand = await Brand.find({isBlocked:false})

       if(category && brand){
        res.render('admin/products',{
            products:productData,
            currentPage:page,
            
            totalPages:Math.ceil(count/limit),
            cat:category.name,
            brand:brand.name

        })
       }else{
        console.log("product page loading errors:",error);
        
            res.render('admin/pageError')
       }
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
        console.log('Product ID:', id);
        console.log('Request Body:', req.body);
        const product = await Product.findById(id)
        if(!product){
            console.log("product not found");
            return res.status(404).json({error:"product not found"})

        }
        const data = req.body
        const existingProduct = await Product.findOne({
            productName:data.productName,
            _id:{$ne:id}
        })
        if(existingProduct){
            return res.status(400).json({error:'Product with this name already exists.Please try with another name'})
        }
        const categories = await Category.find({name: data.category})
        if(!categories){
            return res.status(400).json({error:'Invalid category provided'})
        }
        const images =[]
        if(req.files && req.files.length > 0){
            for(let i=0;i<req.files.length;i++){
                images.push(req.files[i].filename)
            }
        }
        const updatedFields = {
            productName:data.productName,
            description:data.description,
            brand:data.brand,
            categorries:data.categories,
            offer:data.productOffer,
            regularPrice:data.regularPrice,
            salePrice:data.salePrice,
            quantity:data.quantity,
            ml:data.ml,

        }
        if(req.files.length > 0){
            updatedFields.$push = {productImage:{$each:images}}
        }
        const editedProduct = await Product.findByIdAndUpdate(id,updatedFields,{new:true})
        console.log('Product ID:', id);
       console.log('edited product:', editedProduct);
        res.redirect('/admin/products')
    } catch (error) {
        console.log('product editing error',error);
        res.redirect('/admin/pageError')
        
    }
}


const getAllProductsGrid = async (req, res) => {
    try {
        const search = req.query.search || "";
        const page = req.query.page || 1;
        const limit = 25;
        const skip = (page - 1) * limit;

        const productData = await Product.find({
            $or: [
                { productName: { $regex: new RegExp(".*" + search + ".*", 'i') } },
                { brand: { $regex: new RegExp(".*" + search + ".*", 'i') } }
            ]
        })
        .limit(limit)
        .skip(skip)
        .populate('category')
        .exec();


        

        const count = await Product.find({
            $or: [
                { productName: { $regex: new RegExp(".*" + search + ".*", 'i') } },
                { brand: { $regex: new RegExp(".*" + search + ".*", 'i') } }
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
const deleteSingleImage = async(req,res)=>{
    try {
        const {imageNameToServer,productIdToServer} = req.body
        const product = await Product.findByIdAndUpdate(productIdToServer,{$pull:{productImage:imageNameToServer}})
        const imagePath = path.join('public','uploads','re-image',imageNameToServer)
        if(fs.existsSync(imagePath)){
            await  fs.unlink(imagePath)
            console.log(`Image ${imageNameToServer} deleted successfully`);
            

        }else{
            console.log(`Image ${imageNameToServer} not found`)
        }
        res.send({status:true})

    } catch (error) {
        console.log('Image deleting error:',error);
        
        res.redirect('/admin/pageError')
    }
}
const addOffer = async(req,res)=>{
    try {
        const {productId,percentage} = req.body
        const findProduct = await Product.findOne({_id:productId})
        const  findCategory = await Category.findOne({_id:findProduct.category})
        if(findCategory.categoryOffer>percentage){
            return res.json({status:false,message:"This products category already has a category offer"})
        }
        findProduct.salePrice = findProduct.salePrice.Math.floor(findProduct.regularPrice*(percentage/100))
        findProduct.productOffer = parseInt(percentage)
        await findProduct.save()
        findCategory.categoryOffer = 0
        await findCategory.save()
        res.json({status:true,message:"Offer added successfully"})

    } catch (error) {
        res.redirect('/admin/pageError')
        res.status(500).json({status:false,message:'Internal server error'})
    }
}

const removeOffer = async(req,res)=>{
    try {
        const {productId} = req.body
        const findProduct = await Product.findOne({_id:productId})
        const percentage = findProduct.productOffer
        findProduct.salePrice = findProduct.salePrice+Math.floor(findProduct.regularPrice*(percentage/100))
        findProduct.productOffer = 0
        await findProduct.save()
        res.json({status:true})
    } catch (error) {
       res.redirect('/admin/pageError') 
    }
}

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
    addOffer,
    removeOffer,
    deleteProduct,
    softDeleteProduct
}
