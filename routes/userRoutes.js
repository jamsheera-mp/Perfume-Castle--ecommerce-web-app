const express = require('express')
const router = express.Router()
const userController = require('../controllers/user/userController')
const productController = require('../controllers/user/productController')
const cartController = require('../controllers/user/cartController')
const orderController = require('../controllers/user/orderController')
const profileController = require('../controllers/user/profileController')
const wishlistController = require('../controllers/user/wishlistController')
const couponController = require('../controllers/user/couponController')
const paymentController = require('../controllers/user/paymentController')
const walletController = require('../controllers/user/walletController')
const invoiceControlller = require('../controllers/user/invoiceController')
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

//password
router.get('/forgotPassword',profileController.getForgotPassword)
router.post('/passwordReset',profileController.passwordReset)
router.post('/verify-pwdforgot-otp',profileController.verifyPwdForgotOTP)
router.get('/reset-password',profileController.getResetPwdPage)
router.post('/resend-otp-for-pwdReset',profileController.resendOtp)
router.post('/reset-password',profileController.postNewPwd)





//profile mgmt
router.get('/profile',userAuth,userController.loadProfile)
router.get('/address',userAuth,userController.loadAddresses)
router.post('/addAddress',userAuth,userController.addAddress)
router.post('/editAddress/:id', userAuth, userController.editAddress)
router.post('/deleteAddress/:addressId', userAuth, userController.deleteAddress);
router.post('/updateProfile',userAuth,userController.updateProfile)
router.post('/changePassword',userAuth,profileController.cahngePassword)


//product mgmt
router.get('/product',userAuth,productController.getProductList)
router.get('/product/:id',userAuth,productController.getProductDetails)
router.get('/search', userAuth,productController.searchProducts); //search




//cart mgmt
 router.get('/cart',userAuth, cartController.listCartItems)
router.post('/addToCart',userAuth, cartController.addToCart)
router.post('/updateCart',userAuth, cartController.updateCart)
router.post('/deleteCartItem/:productId', userAuth, cartController.removeCartItem)
router.post('/clearCart', userAuth,cartController.clearCart)


//online payment

router.post('/createRazorpayOrder', paymentController.createRazorpayOrder);
router.post('/verifyRazorpayPayment', paymentController.verifyRazorpayPayment);


//order mgmt
router.get('/checkout',userAuth,orderController.getCheckout)
router.post('/placeOrder',userAuth,orderController.placeOrder)
router.get('/orderSuccess',userAuth,orderController.getOrderSuccess)
router.get('/orders', userAuth,orderController.getOrderList);
router.get('/track-order/:orderId', userAuth,orderController.trackOrder);
router.post('/cancelOrder/:orderId',userAuth,orderController.cancelOrder)
router.post('/returnOrder/:orderId',userAuth,orderController.returnOrder)


//wallet mgmt
router.get('/wallet',userAuth,walletController.getWallet)


//wishlist management
router.get('/wishlist',userAuth,wishlistController.getWishlist)
router.post('/toggleWishlist/:productId', wishlistController.toggleWishlist);

//router.post('/addToWishlist/:productId',userAuth,wishlistController.addToWishlist)
router.post('/removeFromWishlist/:productId', userAuth, wishlistController.removeFromWishlist)



//coupon mgmt
router.post('/applyCoupon', couponController.applyCoupon);
router.post('/removeCoupon', couponController.removeCoupon);

//invoice
router.get('/download-invoice/:orderId',userAuth,invoiceControlller.downloadInvoice)

module.exports = router