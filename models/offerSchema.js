const mongoose = require('mongoose');

const offerSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['Products', 'Category','Referral'],
        required: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true,
        trim: true
    },
    offerPercentage: {
        type: Number,
        required: true,
        min: 0,
        max: 100
    },
    validFrom: {
        type: Date,
        default: Date.now
    },
    validity: {
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
    status: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Offer', offerSchema);