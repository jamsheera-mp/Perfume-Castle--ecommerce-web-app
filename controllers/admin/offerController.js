const Offer = require('../../models/offerSchema');
const Category = require('../../models/categorySchema');
const Product = require('../../models/productSchema');

// Load offers page with pagination
const offerPageLoad = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;

       
        const offers = await Offer.find()
        .populate('productId', 'productName')
        .populate('categoryId', 'name')
        .skip(skip)
        .limit(limit)
        .sort({ createdAt: -1 })
            
        const totalOffers = await Offer.countDocuments();
        const totalPages = Math.ceil(totalOffers / limit);
 

        res.render('admin/offer', {
            offers,
            totalPages,
            currentPage: page,
            totalOffers
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Error loading offers' });
    }
};



// Load add offer page with products and categories
const addOfferPage = async (req, res) => {
    try {
        // Fetch active products and categories
        const products = await Product.find(
            { isBlocked: false, isDeleted: false },
            '_id productName'
        );
        
        const categories = await Category.find(
            { isListed: true,},
            '_id name '
        );
        const offer = await  Offer.find()||null


        res.render('admin/addOffer', {
            offer,
            products,
            categories,
            message: ''
        });
    } catch (error) {
        console.error('Error in addOfferPage:', error);
        res.status(500).render('admin/add-offer', {
            products: [],
            categories: [],
            message: 'Error loading data'
        });
    }
};

// Add new offer
const addOffer = async (req, res) => {
    try {
        const {
            offerName,
            offerDescription,
            offerPercentage,
            offerValidity,
            offerType,
            offerTypeName
        } = req.body;

        // Validation
        if (!offerName?.trim()) {
            return res.status(400).json({ error: "Offer name is required" });
        }

        if (!offerDescription?.trim()) {
            return res.status(400).json({ error: "Description is required" });
        }

        const percentage = Number(offerPercentage);
        if (isNaN(percentage) || percentage <= 0 || percentage > 100) {
            return res.status(400).json({ error: "Offer percentage must be between 1 and 100" });
        }

        const validityDate = new Date(offerValidity);
        if (isNaN(validityDate) || validityDate <= new Date()) {
            return res.status(400).json({ error: "Please select a future date" });
        }

        // Check for existing active offers
        let existingOffer;
        if (offerType === 'Products') {
            existingOffer = await Offer.findOne({
                productId: offerTypeName,
                status: true,
                validity: { $gt: new Date() }
            });
        } else if (offerType === 'Category') {
            existingOffer = await Offer.findOne({
                categoryId: offerTypeName,
                status: true,
                validity: { $gt: new Date() }
            });
        }

        if (existingOffer) {
            return res.status(400).json({ 
                error: `An active offer already exists for this ${offerType.toLowerCase()}` 
            });
        }

        // Create new offer
        const offerData = new Offer({
            name: offerName,
            description: offerDescription,
            offerPercentage: percentage,
            validity: validityDate,
            type: offerType,
           status:true
        });

       // Add type-specific fields
       if (offerType === 'Products') {
        offerData.productId = offerTypeName;
    } else if (offerType === 'Category') {
        offerData.categoryId = offerTypeName;
    }

    // Create and save the offer
    const newOffer = new Offer(offerData);
    await newOffer.save();
        res.status(201).json({ success: true, message: "Offer created successfully" });

    } catch (error) {
        console.error('Offer creation error:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message || "Error creating offer" 
        });
    }
};
const getProducts = async(req,res)=>{
    try {

        const productData = await Product.find({ isBlocked:false,isDeleted:false },'_id productName');
        const products = productData.map(product =>({ id: product._id, name:product.productName}));
        res.json({ products });

    } catch (error) {
        console.log('Error while loading product data',error.message)
     return res.status(500).json({success:false,message:'Internal Server Error'})
    }

}
const getCategories = async(req,res)=>{
    try {

        const categoryData = await Category.find({ isListed:true },'_id name');
        const categories = categoryData.map(category => ({ id:category._id,name:category.name}));
       
        res.json({ categories });

    } catch (error) {
        console.log('Error while loading category data',error.message)
     return res.status(500).json({success:false,message:'Internal Server Error'})
    }

}
// Change offer status
const changeOfferStatus = async (req, res) => {
    try {
        const { offerId, status } = req.params;
        
        const offer = await Offer.findById(offerId);
        if (!offer) {
            return res.status(404).json({ success: false, error: "Offer not found" });
        }

        if (offer.validity < new Date()) {
            return res.status(400).json({ success: false, error: "Cannot modify expired offer" });
        }

        // Set the new status based on the action
        const newStatus = status === 'activate';
       
        //Update the offer status
        const updatedOffer = await Offer.findByIdAndUpdate(
            offerId,
            {status: newStatus},
            {new: true}
        )
        if (!updatedOffer) {
            return res.status(404).json({ 
                success: false, 
                error: "Failed to update offer status" 
            });
        }

        res.json({ 
            success: true, 
            message: `Offer ${status}d successfully` 
        });

    } catch (error) {
        console.error('Error changing offer status:', error);
        res.status(500).json({ 
            success: false, 
            error: "Error changing offer status" 
        });
    }
};
// Delete offer
const deleteOffer = async (req, res) => {
    try {
        const { offerId } = req.query;
        
        const offer = await Offer.findByIdAndDelete(offerId);
        if (!offer) {
            return res.status(404).json({ error: "Offer not found" });
        }

        res.json({ success: true, message: "Offer deleted successfully" });

    } catch (error) {
        res.status(500).json({ 
            success: false, 
            error: "Error deleting offer" 
        });
    }
};

module.exports = {
    offerPageLoad,
    addOfferPage,
    addOffer,
    changeOfferStatus,
    deleteOffer,
    getCategories,
    getProducts
};