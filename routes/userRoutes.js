const express = require('express')
const router = express.Router()
const userController = require('../controllers/user/userController')
const passport =  require('passport')

//const registerValidation = require('.././middlewares/user/authValidation')


router.get('/',userController.loadHome)
router.get('/pageNotFound',userController.pageNotFound)
router.get('/login',userController.loadLogin)
router.get('/register',userController.loadRegister)
router.get('/verify-otp', userController.loadVerifyOtp);
router.get('/logout',userController.logout)

router.get('/auth/google',
    passport.authenticate('google',{scope:['profile','email']}))
router.get('/google/callback',passport.authenticate('google',{failureRedirect:'/register'}),(req,res )=>{
    res.redirect('/')
    })


router.post('/register',userController.register)
router.post('/login',userController.login)
router.post('/verify-otp',userController.verifyOtp)
router.post('/resend-otp',userController.resendOtp)





 

module.exports = router