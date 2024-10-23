const Coupon = require('../../models/couponSchema');


// Get coupon management page
const getCouponPage = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;// Get current page or default to 1
    const itemsPerPage = 12;// Number of items per page

    const totalCoupons = await Coupon.countDocuments({});  // Get total count of coupons for pagination

    const coupons = await Coupon.find({})
    .sort( {createdOn: -1})
    .skip((page - 1) * itemsPerPage) // Skip the previous items
    .limit(itemsPerPage)// Limit to the number of items per page;

    const totalPages = Math.ceil(totalCoupons / itemsPerPage); // Calculate total pages

    res.render('admin/coupon', { 
      coupons,
      currentPage: page,
      totalPages
     });
  } catch (error) {
    console.error('Error fetching coupons:', error);
    res.status(500).send('An error occurred while fetching coupons');
  }
}

function generateCouponCode(length = 8) {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let couponCode = '';
  for (let i = 0; i < length; i++) {
    couponCode += characters.charAt(Math.floor(Math.random() * characters.length));
  }

  return `Coupon#${couponCode}`;
}

// Create a new coupon
const createCoupon = async (req, res) => {
  try {
    const { name, expireOn, offerPrice, minimumPrice } = req.body;
    console.log('coupon details:', name, expireOn, offerPrice, minimumPrice);
    
    const code = generateCouponCode();

    
    const newCoupon = new Coupon({
      name,
      expireOn,
      offerPrice,
      minimumPrice,
      code
    });
    await newCoupon.save();
    console.log('new coupon:', newCoupon);

    res.redirect('/admin/coupons');
  } catch (error) {
    console.error('Error creating coupon:', error);
    res.status(500).send('An error occurred while creating the coupon');
  }
}

// Delete a coupon
const deleteCoupon = async (req, res) => {
  try {
    const couponId = req.params.id;
    await Coupon.findByIdAndDelete(couponId);
    res.redirect('/admin/coupons');
  } catch (error) {
    console.error('Error deleting coupon:', error);
    res.status(500).send('An error occurred while deleting the coupon');
  }
}


module.exports = {
  getCouponPage,
  createCoupon,
  deleteCoupon
};