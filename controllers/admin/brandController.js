const Brand = require('../../models/brandSchema')




const brandInfo = async (req,res)=>{
    try {
        
        const page = parseInt(req.query.page) || 1
        const limit = parseInt(req.query.limit) || 4  
        const skip = (page-1)*limit

        const brandData = await Brand.find({})
        .sort({createdAt:1})
        .skip(skip)
        .limit(limit)
        .exec()

        const totalBrands = await Brand.countDocuments()
        const  totalPages = Math.ceil(totalBrands/limit)
       
        res.render('admin/brands',{
            data : brandData,
            currentPage :page,
            totalPages : totalPages,
            totalBrands:totalBrands
        })

    } catch (error) {
        console.log("brand pahe loading error",error);
        res.status(500).json({ 
            success: false,
            message: 'Failed to load brands page'
        });
    }
}
const addBrand = async(req,res)=>{
    try {
        
        const { brandName, description } = req.body
        
        
        if (!brandName || !description) {
            return res.status(400).json({
                success:false,
                message: 'Brand name and description are required'
            });
        }
        const existingBrand = await Brand.findOne({brandName:brandName})
        if (existingBrand) {
            return res.status(409).json({
                success:false,
                message: 'Brand already exists'
            });
        }
            const newBrand = new Brand({
                brandName : brandName,
                description : description
            })
            await newBrand.save()
            res.status(200).json({
                success:true,
                message: 'Brand added successfully'
            });
        

    } catch (error) {
        console.log("add brands error",error);
        res.status(500).json({
            success:false,
            message: 'Failed to add brand'
        });
    }
}
const blockBrand = async(req,res)=>{
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({
               success:false,
                message: 'Brand ID is required'
            });
        }
        const brand = await Brand.findByIdAndUpdate(
            id,
            { isBlocked: true },
            { new: true }
        );
        if (!brand) {
            return res.status(404).json({
                success:false,
                message: 'Brand not found'
            });
        }
        res.status(200).json({
            success:true,
            message: 'Brand blocked successfully'
        });

    } catch (error) {
        console.log("brand blocking error",error);
        res.status(500).json({
            success:false,
            message: 'Failed to block brand'
        });
    }
}

const unBlockBrand = async(req,res)=>{
    try {
        const { id } = req.params;
        console.log("Unblocking brand with ID:", id); 

        if (!id) {
            return res.status(400).json({
                success:false,
                message: 'Brand ID is required'
            });
        }

        const brand = await Brand.findByIdAndUpdate(
            id,
            { isBlocked: false },
            { new: true }
        );

        if (!brand) {
            return res.status(404).json({
                success:false,
                message: 'Brand not found'
            });
        }

        res.status(200).json({
            success:true,
            message: 'Brand unblocked successfully'
        });

    } catch (error) {
        console.log("brand unblocking error",error);
        res.status(500).json({
           success:false,
            message: 'Failed to unblock brand'
        });
    }
}
const deleteBrand = async(req,res)=>{
    try {
        const { id } = req.params;
        if(!id){
            return res.status(400).json({
                success:false,
                message: 'Brand ID is required'
            });
        }
        const brand = await Brand.findByIdAndDelete(id);
        if (!brand) {
            return res.status(404).json({
                success:false,
                message: 'Brand not found'
            });
        }
        res.status(200).json({
            success:true,
            message: 'Brand deleted successfully'
        });

    } catch (error) {
        console.log("brand deleting error",error);
        res.status(500).json({
            success:false,
            message: 'Failed to delete brand'
        });
    }
}
module.exports = {
     brandInfo,
    addBrand,
    blockBrand,
    unBlockBrand,
    deleteBrand
}