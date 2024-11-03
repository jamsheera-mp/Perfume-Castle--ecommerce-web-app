const User = require('../models/userSchema')



//Authentication : Check if the user is logged in
const isUserAuthenticated = (req,res,next) =>{
    if(req.session && req.session.user){
        return next()
    }else{
        res.redirect('/login')
    }
}


//Authorization : Check if the user is valid and not blocked
const userAuth = (req,res,next)=>{
    if(req.session && req.session.user){
        const userId = req.session.user
        User.findById(userId)
        .then(user=>{
            if(user && !user.isBlocked){
                next()
            }else{
                res.redirect('/login')
            }
        })
        .catch(error=>{
            console.log("Error in user auth middleware:",error)
            res.status(500).send('Internal server error')
        })

    }else{
        
        res.redirect('/login')
    }
}


const adminAuth = (req,res,next)=>{
   
        User.findOne({isAdmin:true})
        .then(data=>{
            if(data){
                next()
            }else{
                res.redirect('/admin/login')
            }
        })
        .catch(error=>{
            console.log("Error in admin auth middleware:",error)
            res.status(500).send('Internal server error')
        })
    
    

    
}


module.exports ={
    isUserAuthenticated,
    userAuth,
    adminAuth
}