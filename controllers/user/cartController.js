

const Product = require('../../models/productSchema')
const Cart = require('../../models/cartSchema')

const addToCart = async (req, res) => {
    try {
        const { productId, quantity } = req.body;
        const userId = req.user ? req.user._id : null;
    
        const product = await Product.findById(productId);
        if (!product) {
          return res.status(404).send('Product not found');
        }
    
        const price = product.salePrice;
        const totalPrice = price * parseInt(quantity);
    
        if (userId) {
          // Logged-in user: Use database cart
          let cart = await Cart.findOne({ userId });
          if (!cart) {
            cart = new Cart({ userId, items: [] });
          }
    
          const existingItemIndex = cart.items.findIndex(item => item.productId.toString() === productId);
          console.log('index:',existingItemIndex);
          
    
          if (existingItemIndex > -1) {
            cart.items[existingItemIndex].quantity += parseInt(quantity);
            cart.items[existingItemIndex].totalPrice += totalPrice;
          } else {
            cart.items.push({
              productId,
              quantity: parseInt(quantity),
              price,
              totalPrice,
              status: 'placed'
            });
          }
    
          await cart.save();
          log('cart:',cart)
        } else {
          // Guest user: Use session cart
          if (!req.session.cart) {
            req.session.cart = { items: [] };
          }
    
          const existingItemIndex = req.session.cart.items.findIndex(item => item.productId.toString() === productId);
    
          if (existingItemIndex > -1) {
            req.session.cart.items[existingItemIndex].quantity += parseInt(quantity);
            req.session.cart.items[existingItemIndex].totalPrice += totalPrice;
          } else {
            req.session.cart.items.push({
              productId,
              quantity: parseInt(quantity),
              price,
              totalPrice,
              status: 'placed'
            });
          }
    
          
        }
    
        res.redirect('/cart');
      } catch (error) {
        console.error('Error adding item to cart:', error);
        res.status(500).send('Error adding item to cart: ' + error.message);
      }
    };
  
    const listCartItems = async (req, res) => {
        try {
            const userId = req.user ? req.user._id : null;
            let cartItems = [];
    
            if (userId) {
                // Logged-in user: Fetch cart from database
                const cart = await Cart.findOne({ userId }).populate('items.productId');
                cartItems = cart ? cart.items : [];
            } else {
                // Guest user: Get cart from session
                const sessionCart = req.session.cart || { items: [] };
                cartItems = await Promise.all(sessionCart.items.map(async (item) => {
                    const product = await Product.findById(item.productId);
                    return { ...item, productId: product };
                }));
            }
    
            res.render('user/cart', { cartItems });
        } catch (error) {
            console.error('Error fetching cart items:', error);
            res.status(500).send('Error fetching cart items: ' + error.message);
        }
    };
    const updateCartItem = async (req, res) => {
        try {
            const { productId, quantity } = req.body;
            const userId = req.user ? req.user._id : null;
    
            if (userId) {
                let cart = await Cart.findOne({ userId });
                if (cart) {
                    const item = cart.items.find(item => item.productId.toString() === productId);
                    if (item) {
                        item.quantity = quantity;
                        item.totalPrice = item.price * quantity;
                        await cart.save();
                    }
                }
            } else {
                let sessionCart = req.session.cart;
                if (sessionCart) {
                    const item = sessionCart.items.find(item => item.productId.toString() === productId);
                    if (item) {
                        item.quantity = quantity;
                        item.totalPrice = item.price * quantity;
                    }
                }
            }
    
            res.status(200).json({ message: 'Cart updated successfully' });
        } catch (error) {
            console.error('Error updating cart item:', error);
            res.status(500).send('Error updating cart item: ' + error.message);
        }
    };
    
    const removeCartItem = async (req, res) => {
        try {
            const { productId } = req.body;
            const userId = req.user ? req.user._id : null;
    
            if (userId) {
                let cart = await Cart.findOne({ userId });
                if (cart) {
                    cart.items = cart.items.filter(item => item.productId.toString() !== productId);
                    await cart.save();
                }
            } else {
                let sessionCart = req.session.cart;
                if (sessionCart) {
                    sessionCart.items = sessionCart.items.filter(item => item.productId.toString() !== productId);
                }
            }
    
            res.status(200).json({ message: 'Item removed from cart successfully' });
        } catch (error) {
            console.error('Error removing cart item:', error);
            res.status(500).send('Error removing cart item: ' + error.message);
        }
    };
    
    const clearCart = async (req, res) => {
        try {
            const userId = req.user ? req.user._id : null;
    
            if (userId) {
                await Cart.deleteOne({ userId });
            } else {
                req.session.cart = { items: [] };
            }
    
            res.status(200).json({ message: 'Cart cleared successfully' });
        } catch (error) {
            console.error('Error clearing cart:', error);
            res.status(500).send('Error clearing cart: ' + error.message);
        }
    };
    

  const mergeGuestCartWithUserCart = async (userId) => {
    try {
        if (!req.session.cart || !req.session.cart.items.length) return;
    
        let userCart = await Cart.findOne({ userId });
        if (!userCart) {
          userCart = new Cart({ userId, items: [] });
        }
    
        req.session.cart.items.forEach(sessionItem => {
          const existingItemIndex = userCart.items.findIndex(item => 
            item.productId.toString() === sessionItem.productId.toString()
          );
    
          if (existingItemIndex > -1) {
            userCart.items[existingItemIndex].quantity += sessionItem.quantity;
            userCart.items[existingItemIndex].totalPrice += sessionItem.totalPrice;
          } else {
            userCart.items.push(sessionItem);
          }
        });
    
        await userCart.save();
        req.session.cart = null; // Clear the session cart after merging
        await new Promise((resolve) => req.session.save(resolve)); // Ensure session is saved
      } catch (error) {
        console.error('Error merging guest cart with user cart:', error);
      }
    };

  module.exports = {
    addToCart,
    listCartItems,
    updateCartItem,
    removeCartItem,
    clearCart,
    mergeGuestCartWithUserCart
  }