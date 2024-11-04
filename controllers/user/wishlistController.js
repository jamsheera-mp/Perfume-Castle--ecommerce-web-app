const User = require('../../models/userSchema')
const Product = require('../../models/productSchema')
const Wishlist = require('../../models/wishlistSchema')


const toggleWishlist = async(req,res)=>{
    try {
        if (!req.session.user) {
            // If no user is logged in, redirect to login page
            return res.status(200).json({
                success: false,
                redirect: '/login' 
            });
        }
        const userId = req.session.user
        const productId = req.params.productId;
    
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({success: false, message: 'Product not found'});
        }
    
        let wishlist = await Wishlist.findOne({ userId });
    
        if (!wishlist) {
            wishlist = new Wishlist({ userId, products: [] });
        }
    
        const productIndex = wishlist.products.findIndex(
            (item) => item.productId.toString() === productId
        );
    
        if (productIndex > -1) {
            // Product exists in wishlist - remove it
            wishlist.products.splice(productIndex, 1);
            await wishlist.save();
            return res.status(200).json({
                success: true, 
                message: 'Product removed from wishlist',
                action: 'removed',
                isInWishlist:false,
                wishlistCount: wishlist.products.length
            });
        } else {
            // Product doesn't exist in wishlist - add it
            wishlist.products.push({ productId });
            await wishlist.save();
            return res.status(200).json({
                success: true, 
                message: 'Product added to wishlist',
                action: 'added',
                isInWishlist:true,
                wishlistCount: wishlist.products.length
            });
        }
    } catch (error) {
        console.error('Wishlist toggle error:', error);
        res.status(500).json({
            success: false, 
            message: 'Error updating wishlist', 
            error: error.message 
        });
    }
}

const getWishlist = async (req, res) => {
    try {

        const userId = req.session.user;
       
        const page = parseInt(req.query.page) || 1;
        const itemsPerPage = 12;

        const wishlist = await Wishlist.findOne({ userId }).populate('products.productId');

        if (!wishlist || !wishlist.products || wishlist.products.length === 0) {
            return res.render('user/wishlist', { 
                wishlist: [],
                currentPage: 1,
                totalPages: 1,
                itemsPerPage
            });
        }

        // Filter out products that have been deleted from the database
        const availableProducts = await Promise.all(wishlist.products.filter(async (item) => {
            const product = await Product.findById(item.productId);
            return product !== null;
        }));

        // Update the wishlist with only the available products
        await Wishlist.findOneAndUpdate(
            { userId },
            { $set: { products: availableProducts } },
            { new: true }
        );

        const formattedWishlist = wishlist.products.map(item => ({
            productId: item.productId?._id ,
            productName: item.productId?.productName ,
            productImage: item.productId?.productImage ,
            salePrice: item.productId?.salePrice ,
            addedOn: item.addedOn
        })).filter(item => item.productId !== undefined)

        const totalItems = formattedWishlist.length;
        const totalPages = Math.ceil(totalItems / itemsPerPage);
        const startIndex = (page - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const paginatedWishlist = formattedWishlist.slice(startIndex, endIndex);

        return res.render('user/wishlist', {
            wishlist: paginatedWishlist,
            currentPage: page,
            totalPages: totalPages,
            itemsPerPage: itemsPerPage
        });
    } catch (error) {
        console.error('Error fetching wishlist:', error);
        res.status(500).render('user/404', { message: 'Error fetching wishlist' });
    }
};
const removeFromWishlist = async(req,res)=>{
  try {
      const userId = req.session.user
      const productId = req.params.productId;
  
      const wishlist = await Wishlist.findOne({ userId });
  
      if (!wishlist) {
        return res.status(404).json({success:false, message: 'Wishlist not found' });
      }
  
      const productIndex = wishlist.products.findIndex(
        (item) => item.productId.toString() === productId
      );
  
      if (productIndex === -1) {
        return res.status(400).json({ success:false,message: 'Product not in wishlist' });
      }
  
      wishlist.products.splice(productIndex, 1);
      await wishlist.save();
  
      res.status(200).json({success:true, message: 'Product removed from wishlist',wishlistCount:wishlist.products.length });
    } catch (error) {
      console.log('An error occured while removing item from wishlist',error)
      res.status(500).json({success:false, message: 'Error removing product from wishlist', error: error.message });
    }
}


module.exports = {
    toggleWishlist,
    getWishlist,
    removeFromWishlist
}