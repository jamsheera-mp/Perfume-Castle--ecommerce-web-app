
const Category = require('../../models/categorySchema')


const categoryInfo = async (req,res)=>{
    try {
        const page = parseInt(req.query.page) || 1
        const limit = 6
        const skip =(page-1)*limit

        const categoryData = await Category.find({})
        .sort({createdAt:-1})
        .skip(skip)
        .limit(limit)

        const totalCategories = await  Category.find({}).countDocuments()
        const totalPages = Math.ceil(totalCategories/limit)
        res.render('admin/category',{
            cat:categoryData,
            currentPage:page,
            totalPages:totalPages,
            totalCategories:totalCategories
        })
        


    } catch (error) {
        console.error(error);
        res.redirect('/admin/pageError')
        
    }
}
const addCategory =async(req,res)=>{
    const {name,description} = req.body
try {
    const existingCategory = await Category.findOne({name})
    if(existingCategory){
        return res.status(400).json({error:'Category already exists'})
    }
    const newCategory =  new Category({name,description})
    await newCategory.save()
    return res.json({message:'Category added successfully', category: newCategory})

} catch (error) {
    return res.status(500).json({error:'Internal server error'})
}
}
const loadEditCategory =  async (req,res)=>{
try {
    const id = req.query.id
    const category = await Category.findOne({_id:id})
    res.render('admin/editCategory',{category:category})

} catch (error) {
    res.redirect('/admin/pageError')
}
}

const editCategory = async (req,res) =>{
    try {
        const id = req.params.id
        const {categoryName,description} = req.body


        console.log('Editing category with ID:', id);
        console.log('New data:', { categoryName, description });

        // Check if a category with the same name already exists
        const existingCategory = await Category.findOne({name:categoryName})
        if(existingCategory && existingCategory._id.toString() !== id){
            return res.status(400).json({error:'Category already exists,please choose another name'})
        }

        //update the category
        const updateCategory = await Category.findByIdAndUpdate(id,{
            name:categoryName,
            description
        },{new:true})

        if(updateCategory){
            
            res.redirect('/admin/category')
             
        }else{
            res.status(404).json({error:'Category not found'})
        }
    } catch (error) {
        console.log('Error updating category:',error);
        
        res.status(500).json({error:'Internal server error'})
    }
}

module.exports = {
    categoryInfo,
    addCategory,
    loadEditCategory,
    editCategory
}