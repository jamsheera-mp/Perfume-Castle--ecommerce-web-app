const express = require('express')
const router = express.Router()
const userController = require('../controllers/user/userController')
const productController = require('../controllers/user/productController')
const cartController = require('../controllers/user/cartController')
const {userAuth} =  require('../middlewares/auth')


 
const passport =  require('passport')

//const registerValidation = require('.././middlewares/user/authValidation')


//login mgmt
router.get('/',userController.loadHome)
router.get('/pageNotFound',userController.pageNotFound)
router.get('/login',userController.loadLogin)
router.get('/register',userController.loadRegister)
router.get('/verify-otp', userController.loadVerifyOtp);
router.get('/logout',userController.logout)


//google auth
router.get('/auth/google',
    passport.authenticate('google',{scope:['profile','email']}))
router.get('/google/callback',passport.authenticate('google',{failureRedirect:'/register'}),(req,res )=>{
    res.redirect('/')
    })
    
router.post('/register',userController.register)
router.post('/login',userController.login)
router.post('/verify-otp',userController.verifyOtp)
router.post('/resend-otp',userController.resendOtp)


//product mgmt
router.get('/product',productController.getProductList)
router.get('/product/:id',productController.getProductDetails)


//profile mgmt
 router.get('/profile',userAuth,userController.loadProfile)
 router.get('/address',userAuth,userController.loadAddresses)
 router.post('/addAddress',userAuth,userController.addAddress)
 router.post('/editAddress/:id', userAuth, userController.editAddress)
 router.post('/deleteAddress/:addressId', userAuth, userController.deleteAddress);



 //cart mgmt
 router.get('/cart', cartController.listCartItems)
router.post('/addToCart', cartController.addToCart)
router.post('/cart/update', cartController.updateCartItem)
router.post('/cart/remove', cartController.removeCartItem)
router.post('/cart/clear', cartController.clearCart)

//order mgmt
// router.get('/order', userAuth, orderController.getOrderList)
// router.get('/order/:id', userAuth, orderController.getOrderDetails)
// router.post('/order', userAuth, orderController.createOrder)




 

module.exports = router