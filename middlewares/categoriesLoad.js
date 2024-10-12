const Category = require('../models/categorySchema')
const Brand = require('../models/brandSchema')

// middleware to fetch categories and brands
const categoryBrandMiddleware = async (req, res, next) => {
  try {
    // Fetch categories and brands from the database
    const categories = await Category.find(); // Adjust this to your actual Category model
    const brands = await Brand.find(); // Adjust this to your actual Brand model
    
    // Make them available in all EJS views
    res.locals.categories = categories;
    res.locals.brands = brands;
    
    next(); // Proceed to the next middleware or route handler
  } catch (error) {
    console.error('Error fetching categories and brands:', error);
    next(error); // Pass the error to the error handler
  }
};

module.exports =  categoryBrandMiddleware;

