const { calculateProductPrices } = require('../../middlewares/priceCalculator')


const Product = require('../../models/productSchema')
const Cart = require('../../models/cartSchema');


const addToCart = async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    const userId = req.session.user;
    const requestedQuantity = parseInt(quantity);


    // Validate product availability
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    // Check product status
    if (product.status !== 'Available' || product.isBlocked || product.isDeleted) {
      return res.status(400).json({ success: false, error: 'Product is not available for purchase' });
    }

    // Validate stock

    if (product.quantity < requestedQuantity) {
      return res.status(400).json({ success: false, error: `Only ${product.quantity} items available in stock` });
    }

    // Get or create cart
    let cart = await Cart.findOne({ userId });
    if (!cart) {
      cart = new Cart({ userId, items: [] });
    }
    //Max quantity a user can add to cart for a product
    const maxQuantityPerUser = 5;


    // Store product in request for middleware
    req.products = product;
        
    // Calculate price with offers
    await calculateProductPrices(req, res, () => {});
    const processedProduct = req.products;

   
    console.log('requested product:',req.products)
    if (!processedProduct) {
      return res.status(500).json({ success: false, error: 'Error processing product prices' });
    }

    const finalPrice = processedProduct.finalPrice;
    console.log('final price:',finalPrice)

    // Update cart items
    const existingItemIndex = cart.items.findIndex(item => item.productId.toString() === productId);

    if (existingItemIndex > -1) {
      //product already in cart,update quantity
      const existingItem = cart.items[existingItemIndex];
      const newQuantity = existingItem.quantity + requestedQuantity;

      //check if new quantity exceeds maxQuantityPerUser
      if (newQuantity > maxQuantityPerUser) {
        const availableToAdd = maxQuantityPerUser - existingItem.quantity;

        return res.status(400).json({
          success: false,
          error: `Cannot add ${requestedQuantity} more items. You can Only  add ${availableToAdd} more items of this product.`
        });
      }
      //check if new quantity exceeds stock
      if (newQuantity > product.quantity) {
        const availableQuantity = product.quantity - existingItem.quantity
        return res.status(400).json({
          success: false,
          error: `Cannot add ${requestedQuantity} more items. Only ${availableQuantity} additional items available.`
        })

      }
      //update existing item
      cart.items[existingItemIndex] = {
        ...existingItem,
        quantity: newQuantity,
        price:  finalPrice,
        totalPrice:  newQuantity * finalPrice,
        
      }
      
      //update existing item's quantity and price
      //existingItem.quantity = newQuantity;
      //existingItem.price =  finalPrice;
      //existingItem.totalPrice = newQuantity *  finalPrice;
      


    } else {
      // product is not in cart,add new item
      //check if requested quantity exceeds maxQuantityPerUser

      if (requestedQuantity > maxQuantityPerUser) {
        return res.status(400).json({
          success: false,
          error: `Cannot add more than ${maxQuantityPerUser} items of the same product to cart`
        });
      }
      //Add new items to cart
      cart.items.push({
        productId: product._id,
        quantity: requestedQuantity,
        price:  finalPrice,
        totalPrice: requestedQuantity *  finalPrice,
       
        
      });
    }
    console.log('final cart',cart)

    // Update cart subtotal
    cart.cartSubTotal = cart.items.reduce((sum, item) => sum + item.totalPrice, 0);

    await cart.save();

    return res.json({
      success: true,
      cart: {
        items: cart.items.map(item=>({
          productId:item.productId,
          quantity: item.quantity,
          price: finalPrice,
          finalPrice: finalPrice,
          totalPrice:item.totalPrice
 
        })),
        
        cartSubTotal: cart.cartSubTotal,
        cartItemCount: cart.items.length,

      }
    });
  } catch (error) {
    console.error('Error adding item to cart:', error.message);
    res.status(500).json({ success: false, error: 'Internal server error' + error.message });
  }
};

//----------------------------------------------update cart-----------------------------------------------
const updateCart = async (req, res) => {
  try {
    const { productId, newQuantity } = req.body;
    const userId = req.session.user;

    // Input validation
    if (!productId || !newQuantity) {
      return res.status(400).json({
        success: false,
        error: 'Product ID and quantity are required'
      });
    }




    // Find the product and check stock
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    // Check if product is available
    if (product.status !== 'Available' || product.isBlocked || product.isDeleted) {
      return res.status(400).json({
        success: false,
        error: 'Product is not available for purchase'
      });
    }

    // Check stock availability
    if (newQuantity > product.quantity) {
      return res.status(400).json({
        success: false,
        error: `Only ${product.quantity} items available in stock`
      });
    }

    // Find or create cart
    let cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({
        success: false,
        error: 'Cart not found'
      });
    }

    // Update cart item
    const itemIndex = cart.items.findIndex(item =>
      item.productId.toString() === productId
    );

    if (itemIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Item not found in cart'
      });
    }
    // Check max quantity per user
    const maxQuantityPerUser = 5;
    if (newQuantity > maxQuantityPerUser) {
      return res.status(400).json({
        success: false,
        error: `You can only add up to ${maxQuantityPerUser} of this item`
      });
    }

    // Get the processed product with final price from middleware
    req.products = product;
        
    // Calculate price with offers
    await calculateProductPrices(req, res, () => {});
    const processedProduct = req.products;

    if (!processedProduct) {
      return res.status(500).json({ success: false, error: 'Error processing product prices' });
    }

    const finalPrice = processedProduct.finalPrice;

    // Update quantity and calculate new price
    cart.items[itemIndex].quantity = newQuantity;
    cart.items[itemIndex].price = finalPrice;
    cart.items[itemIndex].totalPrice = newQuantity * finalPrice;

    // Recalculate cart totals
    cart.cartSubTotal = cart.items.reduce((total, item) =>
      total + item.totalPrice, 0
    );

    // Save cart
    await cart.save();
    // Return updated cart details
    return res.json({
      success: true,
      

      cartSubTotal: cart.cartSubTotal,
      itemTotalPrice: cart.items[itemIndex].totalPrice,
      quantity: newQuantity,
      cartItemCount: cart.items.length
    });

  } catch (error) {
    console.error('Error updating cart item:', error);
    res.status(500).json({ success: 'false', error: 'Internal server error' });
  }
};

const removeCartItem = async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.session.user;
    if (!productId || !userId) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request parameters'
      });
    }

    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({ success: 'false', error: 'Cart not found' });
    }

    // Remove item from cart
    cart.items = cart.items.filter(item => item.productId.toString() !== productId);


    // Recalculate cart subtotal
    cart.cartSubTotal = cart.items.reduce((sum, item) => sum + item.totalPrice, 0);
    await cart.save();

    return res.status(200).json({
      success: 'true',
      cartSubTotal: cart.cartSubTotal,
      cartItemCount: cart.items.length
    });

  } catch (error) {
    console.error('Error removing cart item:', error);
    return res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

const clearCart = async (req, res) => {
  try {
    const userId = req.session.user;

    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({ success: false, error: 'Cart not found' });
    }

    // Clear all items and reset subtotal
    cart.items = [];
    cart.cartSubTotal = 0;
    await cart.save();

    res.json({ success: true });

  } catch (error) {
    console.error('Error clearing cart:', error);
    res.status(500).json({ success: 'false', error: 'Internal server error' });
  }
};
//-------------------------------------------------------------------------
const listCartItems = async (req, res) => {
  try {
    const userId = req.session.user;

    const cart = await Cart.findOne({ userId }).populate('items.productId');
    if (!cart) {
      return res.render('user/cart', {
        cartItems: [],
        cartTotalPrice: 0,
        hasOutOfStockItem: false,// Add default value for empty cart

      });
    }


    // Filter out any items where product no longer exists
    cart.items = cart.items.filter(item => item.productId);

    // Process each item through price calculator
    for (const item of cart.items) {
      if (item.productId) {
        // Set product for price calculation
        req.products = item.productId;
        
        // Calculate price with offers
        await calculateProductPrices(req, res, () => {});
        
        // Get processed product with final price
        const processedProduct = req.products;
        
        if (processedProduct) {
          // Update item prices with calculated values
          item.price = processedProduct.finalPrice;
          item.totalPrice = item.quantity * processedProduct.finalPrice;
        }
      }
    }
    // Check if any item in cart is out of stock
    const hasOutOfStockItem = cart.items.some(item =>
      !item.productId || 
      item.productId.quantity === 0||// Check if product exists
      item.productId.stockQuantity < item.quantity  // Check if enough stock


    );

         
  
 // Recalculate cart subtotal with new prices
    cart.cartSubTotal = cart.items.reduce((sum, item) => sum + item.totalPrice, 0);
    await cart.save();

    res.render('user/cart', {
      cartItems: cart.items,
      
      cartTotalPrice: cart.cartSubTotal,
      hasOutOfStockItem,

    });

  } catch (error) {
    console.error('Error fetching cart items:', error);
    res.status(500).send('Error fetching cart items: ' + error.message);
  }
};

module.exports = {
  addToCart,
  listCartItems,
  updateCart,
  clearCart,
  removeCartItem,

}