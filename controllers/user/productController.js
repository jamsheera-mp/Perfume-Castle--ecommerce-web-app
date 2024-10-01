
const Product = require('../../models/productSchema');
const Review = require('../../models/reviewSchema');

// Product listing
const getProductList = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 12;
        const skip = (page - 1) * limit;

        const products = await Product.find({ status: 'Available'})
            .skip(skip)
            .limit(limit)
            .populate('category')
            .populate('brand')
            .lean();

            //console.log("products:",products);
            
        const totalProducts = await Product.countDocuments({ status: 'Available' });
        console.log("totalProducts:",totalProducts);
        

        res.render('user/productListing', {
            products,
            currentPage: page,
            totalPages: Math.ceil(totalProducts / limit),
            totalProducts,
            
        });
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).render('user/404', { message: 'Error fetching products' });
    }
}

// Product detail
const getProductDetails = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id)
        
        if (!product) {
            return res.status(404).render('user/404', { message: 'Product not found' });
        }

        if (!product.category) {
            return res.status(404).render('user/404', { message: 'Product category not found' });
        }

        // Check if guest user, store viewed products in session
        if (!req.session.user) {
            req.session.viewedProducts = req.session.viewedProducts || [];
            if (!req.session.viewedProducts.includes(product._id.toString())) {
                req.session.viewedProducts.push(product._id.toString());
            }
        }

        const reviews = await Review.find({ productId: product._id })
        const averageRating = reviews.length > 0 ? reviews.reduce((acc, review) => acc + review.rating, 0) / reviews.length : 0

        const relatedProducts = await Product.find({
            category: product.category,
            _id: { $ne: product._id }
        }).limit(4);
        console.log(relatedProducts);
        

        res.render('user/details', {
            product,
            reviews,
            averageRating,
            relatedProducts:relatedProducts.length > 0 ? relatedProducts : null
        });
    } catch (error) {
        console.error('Error fetching product details:', error);
        res.status(500).render('user/404', { message: 'Error fetching product details:${error.message}' });
    }
}

module.exports = {
    getProductList,
    getProductDetails

}