const express = require('express')
const adminController = require('../controllers/admin/adminController')
const router = express.Router()
const {adminAuth} = require('../middlewares/auth')
const usersController = require('../controllers/admin/usersController')
const categoryController = require('../controllers/admin/categoryController')
const brandController = require('../controllers/admin/brandController')
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
//router.get('/deleteCategory',adminAuth,categoryController.deleteCategory)

//brand management
router.get('/brands',adminAuth,brandController.brandInfo)
router.post('/addBrand',adminAuth,uploads.single('image'),brandController.addBrand)
router.get('/blockBrand',adminAuth,brandController.blockBrand)
router.get('/unBlockBrand',adminAuth,brandController.unBlockBrand)
router.get('/deleteBrand',adminAuth,brandController.deleteBrand)


//product management
//router.get('/product',adminAuth,categoryController.productInfo)

module.exports =  router;
