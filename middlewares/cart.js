

const Cart = require('../models/cartSchema')

const cartMiddleware = async (req, res, next) => {
    if (req.session.user) {
        try {
            const userId = req.session.user;
            const cart = await Cart.findOne({ userId }); // Find the user's cart

            if (cart) {
                res.locals.cartCount = cart.items.length; // Store cart count in locals
            } else {
                res.locals.cartCount = 0; // If no cart exists
            }
        } catch (error) {
            console.error('Error fetching cart:', error);
            res.locals.cartCount = 0; // Handle error by setting count to 0
        }
    } else {
        res.locals.cartCount = 0; // Set to 0 if user is not logged in
    }

    next(); // Proceed to the next middleware or route handler
};

module.exports = cartMiddleware;