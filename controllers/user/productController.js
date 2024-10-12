
const Product = require('../../models/productSchema');
const Review = require('../../models/reviewSchema');
const Category = require('../../models/categorySchema')
const Brand = require('../../models/brandSchema')
const User = require('../../models/userSchema')
const Cart = require('../../models/cartSchema')
// Product listing
const getProductList = async (req, res) => {
    try {
        const user = req.session.user
        const userId = req.session.user;
        const userData = await User.findById(user)

        // Extract and validate query parameters
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.max(1, Math.min(50, parseInt(req.query.limit) || 12));
        const skip = (page - 1) * limit;
        const sortBy = req.query.sortBy || 'dateAdded';
        const searchQuery = req.query.search?.trim() || '';

        // Extract filter parameters and ensure they're arrays even if single value
        const selectedCategories = Array.isArray(req.query.category)
            ? req.query.category
            : req.query.category
                ? [req.query.category]
                : [];

        const selectedBrands = Array.isArray(req.query.brand)
            ? req.query.brand
            : req.query.brand
                ? [req.query.brand]
                : [];

        const minPrice = parseFloat(req.query.minPrice) || 0;
        const maxPrice = req.query.maxPrice ? parseFloat(req.query.maxPrice) : Number.MAX_VALUE;

        // Build base query
        const baseQuery = {
            isDeleted: false,
            ...(searchQuery && {
                $or: [
                    { productName: { $regex: new RegExp(searchQuery), $options: 'i' } },
                    { description: { $regex: new RegExp(searchQuery), $options: 'i' } }
                ]
            }),
            ...(selectedCategories.length > 0 && { category: { $in: selectedCategories } }),
            ...(selectedBrands.length > 0 && { brand: { $in: selectedBrands } }),
            salePrice: { $gte: minPrice, $lte: maxPrice }
        };

        // Sort mapping
        const sortMapping = {
            'popularity': { popularity: -1 },
            'price-low-high': { salePrice: 1 },
            'price-high-low': { salePrice: -1 },
            'average-rating': { averageRating: -1 },
            'new-arrivals': { dateAdded: -1 },
            'a-z': { productName: 1 },
            'z-a': { productName: -1 },
            'dateAdded': { dateAdded: -1 }
        };

        const sort = sortMapping[sortBy] || sortMapping.dateAdded;

        // Run queries in parallel
        const [categories, brands, products, totalProducts,cart] = await Promise.all([
            Category.find({ isListed: true }).lean(),
            Brand.find({ isBlocked: false }).lean(),
            Product.find(baseQuery)
                .sort(sort)
                .skip(skip)
                .limit(limit)
                .populate('category', 'name')
                .populate('brand', 'brandName')
                .lean(),
            Product.countDocuments(baseQuery),
            Cart.findOne({userId})
        ]);

        //if a cart exists,create a list of  products in the cart
        const cartProductIds = cart ? cart.items.map(item=>item.productId.toString()):[]
        // Add isInCart flag to each product
        const updatedProducts = products.map(product => ({
            ...product,
            isInCart: cartProductIds.includes(product._id.toString())
        }));

        // store the search history for user
        if (user) {
            const userId = req.session.user;
            const searchCategory = selectedCategories.length > 0 ? selectedCategories[0] : null;
            const searchBrand = selectedBrands.length > 0 ? selectedBrands[0] : null;

            // Add search to the user's search history
            await User.findByIdAndUpdate(
                userId,
                {
                    $push: {
                        searchHistory: {
                            category: searchCategory,
                            brand: searchBrand
                        }
                    }
                },
                { new: true }
            );
        }

        // Check if products were found
        let noProductsMessage = '';
        if (products.length === 0) {
            if (searchQuery) {
                noProductsMessage = 'No products found for your search query.';
            } else if (selectedCategories.length > 0 || selectedBrands.length > 0) {
                noProductsMessage = 'No products available in the selected categories or brands.';
            } else {
                noProductsMessage = 'No products available.';
            }
        }

        // Calculate pagination data
        const totalPages = Math.ceil(totalProducts / limit);
        const hasNextPage = page < totalPages;
        const hasPrevPage = page > 1;


       

        // Prepare response data
        const responseData = {
            products:updatedProducts,
            pagination: {
                currentPage: page,
                totalPages,
                totalProducts,
                hasNextPage,
                hasPrevPage,
                limit
            },
            filters: {
                sortBy,
                selectedCategories,
                selectedBrands,
                minPrice: req.query.minPrice || '',
                maxPrice: req.query.maxPrice || '',
                searchQuery
            },
            categories,
            brands,
            user: userData,
            noProductsMessage,
            
        };

        res.render('user/productListing', responseData);

    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).render('user/404', { message: 'Error fetching products' });
    }
}



const searchProducts = async (req, res) => {
    try {
        const user = req.session.user

        const userData = await User.findById(user)

        const searchQuery = req.query.search || ''; // The search term
        const selectedCategory = req.query.category || ''; // The selected category
        const currentPage = parseInt(req.query.page) || 1; // The current page (default to 1)
        const itemsPerPage = parseInt(req.query.limit) || 12; // Number of items per page
        //const sortBy = req.query.sortBy || 'dateAdded'; // Default sort
        const showOutOfStock = req.query.showOutOfStock === 'true'; // Show out-of-stock products


        const skip = (currentPage - 1) * itemsPerPage; // Pagination skip
        const categories = await Category.find({ isListed: true, isDeleted: false });
        const brands = await Brand.find({ isBlocked: false })

        // Construct query for products
        let query = showOutOfStock ? {} : { status: 'Available' }; // Show only available products by default
        console.log("Query:", query);

        if (searchQuery) {
            query.productName = { $regex: new RegExp(searchQuery, 'i') }; // Search by productName, case insensitive
        }
        // Filter by selected category
        if (selectedCategory) {
            query.category = selectedCategory; // Filter by selected category
        }
        // If the user is logged in, store the search history
        if (user) {
            const userId = req.session.user;
            const searchCategory = selectedCategories.length > 0 ? selectedCategories[0] : null;
            const searchBrand = selectedBrands.length > 0 ? selectedBrands[0] : null;

            // Add search to the user's search history
            await User.findByIdAndUpdate(
                userId,
                {
                    $push: {
                        searchHistory: {
                            category: searchCategory,
                            brand: searchBrand
                        }
                    }
                },
                { new: true }
            );
        }

        // Count total products that match the query
        const totalProducts = await Product.countDocuments(query);
        console.log("totalProducts:", totalProducts);
        // Find matching products
        const products = await Product.find(query)
            .skip(skip) // Skip items before the current page
            .limit(itemsPerPage) // Limit items per page

        const totalPages = Math.ceil(totalProducts / itemsPerPage); // Calculate total pages
        res.render('user/search-results', {
            categories,
            brands,
            products, // The products to display
            search: searchQuery, // The search term
            category: selectedCategory, // The selected category
            currentPage, // The current page
            totalPages, // The total number of pages
            user: userData
        });
    } catch (error) {
        res.status(500).send('Error occurred during search');
    }
}



// Product detail
const getProductDetails = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id)
        .populate('brand','brandName')
        .populate('category','name')

        if (!product) {
            return res.status(404).render('user/404', { message: 'Product not found' });
        }

        if (!product.category) {
            return res.status(404).render('user/404', { message: 'Product category not found' });
        }

        

        const reviews = await Review.find({ productId: product._id })
        const averageRating = reviews.length > 0 ? reviews.reduce((acc, review) => acc + review.rating, 0) / reviews.length : 0

        const relatedProducts = await Product.find({
            category: product.category,
            
            _id: { $ne: product._id },
            
        }).populate('brand','brandName')
        .limit(4)||[];
        console.log(relatedProducts);


        res.render('user/details', {
            product,
            reviews,
            averageRating,
            relatedProducts
        });
    } catch (error) {
        console.error('Error fetching product details:', error);
        res.status(500).render('user/404', { message: 'Error fetching product details:${error.message}' });
    }
}

module.exports = {
    getProductList,
    searchProducts,
    getProductDetails

}