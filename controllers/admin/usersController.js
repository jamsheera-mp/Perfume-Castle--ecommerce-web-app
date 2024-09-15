
const User = require('../../models/userSchema')

const userInfo = async (req,res)=>{
    try {
        let search = ""
        if(req.query.search){
            search = req.query.search
        }
        let page =1
        if(req.query.page){
            page = req.query.page  
        }
        const limit = 10
        const userData = await User.find({
            isAdmin:false,
            $or: [
                
                {name: { $regex: ".*"+search+".*", $options: 'i' } },
                {email: { $regex: ".*"+search+".*", $options: 'i' } },
                
                ],   
        })
        .limit(limit*1)
        .skip((page-1)*limit)
        .exec()

        const count = await User.find({
            isAdmin:false,
            $or: [
                
                {name: { $regex: ".*"+search+".*", $options: 'i' } },
                {email: { $regex: ".*"+search+".*", $options: 'i' } },
                
                ],   
        }).countDocuments()
        const totalPages = Math.ceil(count / limit)
        
       res.render('admin/userList',{
        data: userData,
        currentPage: page,
         totalPages: totalPages,
         search: search
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