const express = require('express')
const adminController = require('../controllers/admin/adminController')
const router = express.Router()
const {check} = require('express-validator')
const {adminAuth} = require('../middlewares/auth')
const usersController = require('../controllers/admin/usersController')
const categoryController = require('../controllers/admin/categoryController')
const brandController = require('../controllers/admin/brandController')
const productController = require('../controllers/admin/productController')
const multer =  require('multer')
const storage = require('../helpers/multer')
const uploads = multer({storage:storage})

//error mgmt
router.get('/pageError',adminController.pageError)

//login mgmt
router.get('/login',adminController.loadLogin)
router.get('/dashboard',adminAuth,adminController.loadDashboard)
router.get('/logout',adminController.logout)
router.post('/login',adminController.login)

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

//brand management
router.get('/brands',adminAuth,brandController.brandInfo)
router.post('/addBrand',adminAuth,uploads.single('image'),brandController.addBrand)
router.get('/blockBrand',adminAuth,brandController.blockBrand)
router.get('/unBlockBrand',adminAuth,brandController.unBlockBrand)
router.get('/deleteBrand',adminAuth,brandController.deleteBrand)


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


module.exports =  router;
