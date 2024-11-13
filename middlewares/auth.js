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
                req.session.destroy((error)=>{
                    if(error){
                        console.log("Error destroying session:",error)
                    }
                    res.redirect('/login')
                })
               
            }
        })
        .catch(error=>{
            console.log("Error in user auth middleware:",error)
            req.session.destroy((err) => {
                if (err) {
                    console.log("Error destroying session:", err);
                }
                res.status(500).send('Internal server error');
            });

        })

    }else{
        
        res.redirect('/login')
    }
}


const adminAuth = (req,res,next)=>{
   
        if(req.session.isAdmin){
           
            next()
        }else{
            res.redirect('/admin/login')
        }
}


module.exports ={
    isUserAuthenticated,
    userAuth,
    adminAuth
}