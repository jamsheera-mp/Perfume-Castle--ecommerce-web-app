

const Cart = require('../../models/cartSchema');
const Coupon = require('../../models/couponSchema');

const applyCoupon = async (req, res) => {
  try {
    console.log('Entire request body:', req.body);
    const { couponCode } = req.body;
    console.log('Extracted couponCode:', couponCode);

    if (!couponCode) {
      return res.status(400).json({ success: false, message: 'Missing coupon code', requiresRefresh: false  });
    }
    const userId = req.session.user;
    console.log('User ID from session:', userId);

    if (!userId) {
      return res.status(401).json({ success: false, message: 'User not authenticated',  requiresRefresh: false  });
    }
   

    const coupon = await Coupon.findOne({ code: couponCode, isList: true })

    if (!coupon) {
      return res.status(404).json({ success: false, message: 'Invalid coupon code',  requiresRefresh: false  });
    }

    // Check if coupon is expired
    if (coupon.expireOn < new Date()) {
      return res.status(400).json({ success: false, message: 'Coupon has expired',  requiresRefresh: false  });
    }

    if (coupon.userId.includes(userId)) {
      return res.status(400).json({ success: false, message: 'You have already used this coupon', requiresRefresh: false  });
    }

    // Get cart total
    const cart = await Cart.findOne({ userId }).populate('items.productId');
    const cartTotal = cart.items.reduce((total, item) => total + (item.price * item.quantity), 0);

    // Apply discount
    const discount = Math.min(coupon.offerPrice, cartTotal);
    const finalAmount = cartTotal - discount;

     // Store coupon in session
     req.session.appliedCoupon = {
      couponId: coupon._id,
      couponCode: coupon.code,
      discount:discount
    };

    // Calculate cart total and verify minimum purchase requirements if needed
   
    
    if (cart && coupon.minimumPrice && cart.total < coupon.minimumPrice) {
      return res.status(400).json({
        success: false,
        message: `Minimum purchase of $${coupon.minimumPrice} required for this coupon`,
        requiresRefresh: false
      });
    }

    

    res.status(200).json({
      success: true,
      message: 'Coupon applied successfully',
      couponCode: coupon.code,
      discount: discount,
      finalAmount: finalAmount,
      requiresRefresh: true,
      minimumPurchase : coupon.minimumPrice
      
    });
    

  } catch (error) {
    console.error('Error applying coupon:', error);
    res.status(500).json({ success: false, message: 'Error applying coupon' });
  }
};


const removeCoupon = async (req, res) => {
  try {
    console.log('coupon removing controller reached');
    console.log('Session user:', req.session.user);
    if (!req.session.user) {
      console.log('User not authenticated');
      return res.status(401).json({ 
        success: false, 
        message: 'User not authenticated',
        requiresRefresh: false 
      });
    }
    console.log('coupon is going to remove');
    console.log('Applied coupon before removal:', req.session.appliedCoupon);
    

    // Check if there's a coupon to remove
    if (!req.session.appliedCoupon) {
      console.log('No coupon found to remove');
      return res.status(400).json({
        success: false,
        message: 'No coupon applied to remove',
        requiresRefresh: false
      });
    }

   
        // Get the original cart total before removing coupon
        const cart = await Cart.findOne({ userId: req.session.user }).populate('items.productId');
        const originalTotal = cart.items.reduce((total, item) => total + (item.price * item.quantity), 0);

        // Store coupon details before removal
        const removedCoupon = {
            code: req.session.appliedCoupon.couponCode,
            discount: req.session.appliedCoupon.discount
        };

        // Remove coupon from session
        delete req.session.appliedCoupon;

   

    res.status(200).json({
      success: true,
      message: 'Coupon removed successfully',
      removedCoupon: removedCoupon.code,
      updatedTotal: originalTotal,
      requiresRefresh: true
    });

  } catch (error) {
    console.error('Error removing coupon:', error.message, error.stack);
    res.status(500).json({ 
      success: false, 
      message: 'Error removing coupon'+ error.message,
      requiresRefresh: false 
    });
  }
};

module.exports = {
  applyCoupon,
  removeCoupon
};