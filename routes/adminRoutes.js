const express = require('express')
const adminController = require('../controllers/admin/adminController')
const router = express.Router()
const {check} = require('express-validator')
const {adminAuth} = require('../middlewares/auth')
const usersController = require('../controllers/admin/usersController')
const categoryController = require('../controllers/admin/categoryController')
const brandController = require('../controllers/admin/brandController')
const productController = require('../controllers/admin/productController')
const orderController = require('../controllers/admin/orderController')
const couponController = require('../controllers/admin/couponController')
const offerController = require('../controllers/admin/offerController')
const salesReportController = require('../controllers/admin/salesReportController')

const multer =  require('multer')
const storage = require('../helpers/multer')
const uploads = multer({storage:storage})

//error mgmt
router.get('/pageError',adminController.pageError)

//login mgmt
router.get('/login',adminController.loadLogin)
router.get('/dashboard',adminAuth,adminController.loadDashboard)
router.get('/logout',adminAuth,adminController.logout)
router.post('/login',adminController.login)



//dashboard 
router.get('/dashboard/update-sales', adminAuth, adminController.updateSalesData);
router.get('/dashboard/update-top-products', adminAuth, adminController.updateTopProducts);
router.get('/dashboard/update-top-categories', adminAuth, adminController.updateTopCategories);
router.get('/dashboard/update-top-brands', adminAuth, adminController.updateTopBrands);








//user management
router.get('/users',adminAuth,usersController.userInfo)
router.get('/blockUser',adminAuth,usersController.blockUser)
router.get('/unBlockUser',adminAuth,usersController.unBlockUser)

//category management
router.get('/category',adminAuth,categoryController.categoryInfo)
router.post('/addCategory',adminAuth,categoryController.addCategory)
router.get('/editCategory',adminAuth,categoryController.loadEditCategory)
router.post('/editCategory/:id',adminAuth,categoryController.editCategory)
router.get('/deleteCategory/:id',adminAuth,categoryController.deleteCategory)
router.get('/softDeleteCategory/:id',adminAuth,categoryController.softDeleteCategory)


// brand management routes
router.get('/brands', adminAuth, brandController.brandInfo);
router.post('/addBrand', adminAuth, uploads.single('image'), brandController.addBrand);
router.patch('/blockBrand/:id', adminAuth, brandController.blockBrand);
router.patch('/unBlockBrand/:id', adminAuth, brandController.unBlockBrand);
router.delete('/deleteBrand/:id', adminAuth, brandController.deleteBrand);




//product management
router.get('/addProducts',adminAuth,productController.productInfo)
router.post('/addProducts',adminAuth,uploads.array('images',3),productController.addProducts)
router.get('/products',adminAuth,productController.getAllProducts)
router.get('/productsGrid',adminAuth,productController.getAllProductsGrid)
router.get('/editProduct',adminAuth,productController.getEditProduct)
router.post('/editProduct/:id',adminAuth,uploads.array('images',3),productController.editProduct)
router.post('/deleteImage',adminAuth,productController.deleteSingleImage)

router.post('/deleteProduct/:id',adminAuth,productController.deleteProduct)
router.post('/softDeleteProduct/:id',adminAuth,productController.softDeleteProduct)


//order mgmt

router.get('/orders', adminAuth, orderController.listOrders);
router.get('/order/:orderId', adminAuth, orderController.getOrderDetails);// Order details route
router.post('/order/update/:orderId', adminAuth, orderController.updateOrderStatus);// Order status update route
router.post('/order/cancel/:orderId', adminAuth, orderController.cancelOrderAndUpdateStock);// Order cancellation route

//coupon mgmt
router.get('/coupons',adminAuth,couponController.getCouponPage)
router.post('/createCoupons', couponController.createCoupon);
router.post('/deleteCoupons/:id', couponController.deleteCoupon);


//offer route
router.get('/offers',adminAuth,offerController.offerPageLoad);
router.get('/add-offer',adminAuth,offerController.addOfferPage);
router.post('/addOffer',adminAuth,offerController.addOffer);
router.patch('/offerStatus/:offerId/:newStatus',adminAuth,offerController.changeOfferStatus);
router.delete('/offer',adminAuth,  offerController.deleteOffer);
router.get('/getProducts',adminAuth,offerController.getProducts)
router.get('/getCategories',adminAuth,offerController.getCategories)





//salesReport mgmt
router.get('/sales-report', salesReportController.getSalesReport);
router.get('/download-report', salesReportController.downloadReport);

module.exports =  router;
