const User = require('../../models/userSchema')
const {validationResult} = require('express-validator')

const bcrypt = require('bcryptjs')



const pageError = async(req,res)=>{
    try {
        res.render('admin/pageError')
    } catch (error) {
        console.log("Page not found error:", error.message);
        res.redirect('/admin/pageError')
    }
}

const loadLogin = async (req,res)=>{
    if(req.session.admin){
        return res.redirect('/admin/dashboard')
    }
    res.render('admin/login',{message:null})
}

const login = async (req,res)=>{
    try {
        
        const {email,password} = req.body
        console.log('request body:',req.body);
        
         // Check if both email and password are filled
         if (!email || !password) {
            return res.render('admin/login', { message: 'Email and password are required' });
        }

        //find admin 
        const admin = await User.findOne({email,isAdmin:true})
        console.log('admin:',admin);
        
        //if admin is found, check the password
        if(admin){
            const isValidPassword = await bcrypt.compare(password,admin.password)
            console.log('password:',isValidPassword);
            
            if(isValidPassword){
                req.session.admin = true
                req.session.adminId = admin._id
                return res.redirect('/admin/dashboard')
            }else{
                //Invalid password
                return res.render('admin/login',{message:'Invalid email or password'})
            }

        }else{
            //Admin not found
            return res.render('admin/login',{message:'Admin not found'})
        }
    } catch (error) {
        console.log('login error',error);
        return res.redirect('/admin/pageError')
        
    }
}
const loadDashboard =async (req,res)=>{
   if(req.session.admin){
    try {
        res.render('admin/dashboard')
    } catch (error) {
        console.log('Error loading dashboard',error);
        
        res.redirect('/admin/pageError')
    }
   }else{
         res.redirect('/admin/login')
   }
}

const logout = async (req,res)=>{
    try {
        req.session.destroy(err=>{
            if(err){
                console.log('Error logging out',err);
                return res.redirect('/admin/pageError')
            }
            res.redirect('/admin/login')
        })
    } catch (error) {
        console.log('Unexpected error during logout',error);
        res.redirect('/admin/pageError')
        
    }
}


module.exports ={
    loadLogin,
    login,
    loadDashboard,
    pageError,
    logout
}