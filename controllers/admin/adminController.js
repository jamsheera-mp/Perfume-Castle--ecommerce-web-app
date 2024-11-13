const User = require('../../models/userSchema')
const Order = require('../../models/orderSchema')
const bcrypt = require('bcryptjs')
//const {subDays, subWeeks,subMonths ,subYears} = require('date-fns')


const pageError = async (req, res) => {
    try {
        res.render('admin/pageError')
    } catch (error) {
        console.log("Page not found error:", error.message);
        res.redirect('/admin/pageError')
    }
}

const loadLogin = async (req, res) => {
    try {
        if (req.session.isAdmin) {
            return res.redirect('/admin/dashboard')
        }
         res.render('admin/login', { message: null })

    } catch (error) {
        console.error('Error in loadLogin:', error.message);
       
    }

}

const login = async (req, res) => {
    try {

        const { email, password } = req.body
        console.log('request body:', req.body);

        // Check if both email and password are filled
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required'
            });
        }

        //find admin 
        const admin = await User.findOne({ email, isAdmin: true })
        console.log('admin:', admin);
        if (!admin) {
            return res.status(404).json({
                success: false,
                message: 'Admin not found'
            });
        }

        //if admin is found, check the password

        const isValidPassword = await bcrypt.compare(password, admin.password)
        console.log('password:', isValidPassword);

        if (isValidPassword) {
            req.session.isAdmin = true
            req.session.adminId = admin._id
            return res.status(200).json({
                success: true,
                message: 'Login successful',
                redirectUrl: '/admin/dashboard'
            });
        } else {
            //Invalid password
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }


    } catch (error) {
        console.log('login error', error);
        return res.status(500).json({
            success: false,
            message: 'An error occurred during login'
        });

    }
}
const logout = async (req, res) => {
    try {
        if (!req || !req.session) {
            throw new Error('Invalid session or request object');
        }

        return new Promise((resolve, reject) => {
            req.session.destroy((err) => {
                if (err) {
                    console.error('Session destruction error:', err);
                    reject(err);
                }
                resolve();
            });
        })
            .then(() => {
                res.clearCookie('connect.sid'); // Clear session cookie
                return res.redirect('/admin/login');
            })
            .catch((error) => {
                console.error('Logout error:', error);
                return res.status(500).json({
                    success: false,
                    message: 'An error occurred during logout'
                });
            });
    } catch (error) {
        console.error('Unexpected error during logout:', error.message);
        return res.status(500).json({
            success: false,
            message: 'An unexpected error occurred'
        });
    }
};




//---------------------------------------------------------------------------------------------------------------------
// Helper function to get date range based on period
const getDateRange = (period) => {
    const endDate = new Date();
    let startDate = new Date();
    
    switch (period) {
        case 'daily':
            startDate.setDate(startDate.getDate() - 30); // Last 30 days
            break;
        case 'weekly':
            startDate.setDate(startDate.getDate() - 12 * 7); // Last 12 weeks
            break;
        case 'monthly':
            startDate.setMonth(startDate.getMonth() - 12); // Last 12 months
            break;
        case 'yearly':
            startDate.setFullYear(startDate.getFullYear() - 5); // Last 5 years
            break;
        default:
            startDate.setFullYear(startDate.getFullYear() - 1); // Default to last year
    }
    
    return { startDate, endDate };
};

//function for fetching sales data
const fetchSalesData = async (period) => {
    const { startDate, endDate } = getDateRange(period);

    const salesData = await Order.aggregate([
        { $match: { createdOn: { $gte: startDate, $lte: endDate }, status: { $nin: ['Returned','Cancelled','Return Request','Returned','Failed','Pending']} } },
        { $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdOn" } },
            totalSales: { $sum: "$finalAmount" },
            orderCount: { $sum: 1 }
        }},
        { $sort: { _id: 1 } }
    ]);

    return salesData;
};

//function for fetching product data
const fetchTopProducts = async (period) => {
    const { startDate, endDate } = getDateRange(period);

    const topProducts = await Order.aggregate([
        { $match: { createdOn: { $gte: startDate, $lte: endDate }, status: { $nin: ['Returned','Cancelled','Return Request','Returned','Failed','Pending']} } },
        { $unwind: "$orderedItems" },
        { $group: {
            _id: "$orderedItems.product",
            salesCount: { $sum: "$orderedItems.quantity" },
            totalRevenue: { $sum: { $multiply: ["$orderedItems.quantity", "$orderedItems.price"] } }
        }},
        { $sort: { salesCount: -1 } },
        { $limit: 5 },
        { $lookup: {
            from: 'products',
            localField: '_id',
            foreignField: '_id',
            as: 'productInfo'
        }},
        { $unwind: "$productInfo" },
        { $project: {
            _id: 1,
            productName: "$productInfo.productName",
            salesCount: 1,
            totalRevenue: 1
        }}
    ]);

    return topProducts;
};

//function for fetching categories data
const fetchTopCategories = async (period) => {
    const { startDate, endDate } = getDateRange(period);

    const topCategories = await Order.aggregate([
        { $match: { createdOn: { $gte: startDate, $lte: endDate }, status: { $nin: ['Returned','Cancelled','Return Request','Returned','Failed','Pending']}} },
        { $unwind: "$orderedItems" },
        { $lookup: {
            from: 'products',
            localField: 'orderedItems.product',
            foreignField: '_id',
            as: 'productInfo'
        }},
        { $unwind: "$productInfo" },
        { $group: {
            _id: "$productInfo.category",
            salesCount: { $sum: "$orderedItems.quantity" },
            totalRevenue: { $sum: { $multiply: ["$orderedItems.quantity", "$orderedItems.price"] } }
        }},
        { $sort: { salesCount: -1 } },
        { $limit: 3 },
        { $lookup: {
            from: 'categories',
            localField: '_id',
            foreignField: '_id',
            as: 'categoryInfo'
        }},
        { $unwind: "$categoryInfo" },
        { $project: {
            _id: 1,
            name: "$categoryInfo.name",
            salesCount: 1,
            totalRevenue: 1
        }}
    ]);

    return topCategories;
};

//function to fetch brand data
const fetchTopBrands = async (period) => {
    const { startDate, endDate } = getDateRange(period);

    const topBrands = await Order.aggregate([
        { $match: { createdOn: { $gte: startDate, $lte: endDate }, status: { $nin: ['Returned','Cancelled','Return Request','Returned','Failed','Pending']} } },
        { $unwind: "$orderedItems" },
        { $lookup: {
            from: 'products',
            localField: 'orderedItems.product',
            foreignField: '_id',
            as: 'productInfo'
        }},
        { $unwind: "$productInfo" },
        { $group: {
            _id: "$productInfo.brand",
            salesCount: { $sum: "$orderedItems.quantity" },
            totalRevenue: { $sum: { $multiply: ["$orderedItems.quantity", "$orderedItems.price"] } }
        }},
        { $sort: { salesCount: -1 } },
        { $limit: 5 },
        { $lookup: {
            from: 'brands',
            localField: '_id',
            foreignField: '_id',
            as: 'brandInfo'
        }},
        { $unwind: "$brandInfo" },
        { $project: {
            _id: 1,
            brandName: "$brandInfo.brandName",
            salesCount: 1,
            totalRevenue: 1
        }}
    ]);

    return topBrands;
};

const loadDashboard = async (req, res) => {
    try {
        if (!req) {
            throw new Error('Request object is undefined');
        }

        if (!req.session.isAdmin) {
            return res.redirect('/admin/login');
        }
        const admin = await User.findById(req.session.adminId)
        // Fetch initial data for the dashboard
        const period = 'monthly'; // Default period
        const salesData = await fetchSalesData(period);
        const topProducts = await fetchTopProducts(period);
        const topCategories = await fetchTopCategories(period);
        const topBrands = await fetchTopBrands(period);

        return res.render('admin/dashboard', {
            admin,
            email: req.session.email,
            salesData: JSON.stringify(salesData),
            topProducts: topProducts,
            topCategories: topCategories,
            topBrands: topBrands
        });
    } catch (error) {
        console.error('Error in loadDashboard:', error.message);
        return res.status(500).json({
            success: false,
            message: 'An error occurred while loading the dashboard'
        });
    }
};


const updateSalesData = async (req, res) => {
    try {
        const { period } = req.query;
        const salesData = await fetchSalesData(period);
        res.json(salesData);
    } catch (error) {
        console.error('Error in updateSalesData:', error.message);
        res.status(500).json({ success: false, message: 'Error fetching sales data', error });
    }
};

const updateTopProducts = async (req, res) => {
    try {
        const { period } = req.query;
        const topProducts = await fetchTopProducts(period);
        res.json(topProducts);
    } catch (error) {
        console.error('Error in updateTopProducts:', error.message);
        res.status(500).json({ success: false, message: 'Error fetching top products', error });
    }
};
//update categories
const updateTopCategories = async (req, res) => {
    try {
        const { period } = req.query;
        const topCategories = await fetchTopCategories(period);
        res.json(topCategories);
    } catch (error) {
        console.error('Error in updateTopCategories:', error.message);
        res.status(500).json({ success: false, message: 'Error fetching top categories', error });
    }
};

const updateTopBrands = async (req, res) => {
    try {
        const { period } = req.query;
        const topBrands = await fetchTopBrands(period);
        res.json(topBrands);
    } catch (error) {
        console.error('Error in updateTopBrands:', error.message);
        res.status(500).json({ success: false, message: 'Error fetching top brands', error });
    }
};












module.exports = {
    loadLogin,
    login,
    loadDashboard,
    pageError,
    logout,
    updateSalesData,
    updateTopBrands,
    updateTopCategories,
    updateTopProducts
}