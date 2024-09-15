const express = require('express')
const adminController = require('../controllers/admin/adminController')
const router = express.Router()
const {adminAuth} = require('../middlewares/auth')
const usersController = require('../controllers/admin/usersController')
const categoryController = require('../controllers/admin/categoryController')

//admin
router.get('/pageError',adminController.pageError)
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


module.exports =  router;
