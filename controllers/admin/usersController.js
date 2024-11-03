
const User = require('../../models/userSchema')

const userInfo = async (req,res)=>{
    try {
       let page = req.query.page || 1
        const limit = 10
        const userData = await User.find({isAdmin:false })
        .limit(limit)
        .skip((page-1)*limit)
        .sort({createdAt:1})
       
        console.log('userdata:',userData)
        const count =await User.countDocuments({isAdmin:false})
        const totalPages = Math.ceil(count / limit)
        
       res.render('admin/userList',{
        data: userData,
        currentPage: page,
         totalPages: totalPages,
         })
    } catch (error) {
        console.log(error);
        
    }
}
const blockUser =async(req,res)=>{
    try {
        let id = req.query.id
        await User.updateOne({_id:id},{$set:{isBlocked:true}})
        res.redirect('/admin/users')
    } catch (error) {
        res.redirect('/admin/pageError')
    }
}
const unBlockUser = async(req,res)=>{
    try {
        let id = req.query.id
        await User.updateOne({_id:id},{$set:{isBlocked:false}})
        res.redirect('/admin/users')

    } catch (error) {
        res.redirect('/admin/pageError')
    }
}

module.exports = {
    userInfo,
    blockUser,
    unBlockUser
}