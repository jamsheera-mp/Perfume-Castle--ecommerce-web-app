
const Product = require('../../models/productSchema')
const Category = require('../../models/categorySchema')
const Brand  = require('../../models/brandSchema')
const User = require('../../models/userSchema')
const fs = require('fs')
const path = require('path')
const sharp = require('sharp')

const addProducts = async(req,res)=>{

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

module.exports = {
    addProducts
}
