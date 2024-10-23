

const Wishlist = require('../models/wishlistSchema')

const wishlistMiddleware = async (req, res, next) => {
    try {
        const userId = req.session.user; 
    
        if (userId) {
          const wishlist = await Wishlist.findOne({ userId });
    
          // If wishlist exists, count the products
          const wishlistCount = wishlist ? wishlist.products.length : 0;
    
          // Attach wishlist count to res.locals so it's accessible in all views
          res.locals.wishlistCount = wishlistCount;
        } else {
          // If no user is logged in, set wishlist count to 0
          res.locals.wishlistCount = 0;
        }
    
        next(); // Proceed to the next middleware or route handler
      } catch (error) {
        console.error('Error fetching wishlist count:', error);
        next(error); // Pass error to the next middleware
      }
    };

module.exports = wishlistMiddleware;