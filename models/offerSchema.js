const mongoose = require('mongoose');

const offerSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['product', 'category', 'referral'],
        required: true
    },
    title: {
        type: String,
        required: true
    },
    description: String,
    discountPercentage: {
        type: Number,
        required: true
    },
    validFrom: {
        type: Date,
        required: true
    },
    validTo: {
        type: Date,
        required: true
    },
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product'
    },
    categoryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category'
    },
    referralCode: String,
    isActive: {
        type: Boolean,
        default: true
    }
});

module.exports = mongoose.model('Offer', offerSchema);