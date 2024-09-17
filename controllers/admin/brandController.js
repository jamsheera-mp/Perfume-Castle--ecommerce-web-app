const Brand = require('../../models/brandSchema')
//const  Product = require('../../models/productSchema')



const brandInfo = async (req,res)=>{
    try {
        
        const page = parseInt(req.query.page) || 1
        const limit = parseInt(req.query.limit) || 10
        const skip = (page-1)*limit

        const brandData = await Brand.find({})
        .sort({createdAt:-1})
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
        
        res.redirect('/admin/pageError')
    }
}
const addBrand = async(req,res)=>{
    try {
        
        const brand  = req.body.name
        const findBrand = await Brand.findOne({brand})
        if(!findBrand){
            const image = req.file.filename
            const newBrand = new Brand({
                brandName : brand,
                brandImage : image
            })
            await newBrand.save()
            res.redirect('/admin/brands')
        }

    } catch (error) {
        console.log("add brands error",error);
        
        res.redirect('/admin/pageError')
    }
}

module.exports = {
    brandInfo,
    addBrand
}