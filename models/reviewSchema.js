const mongoose = require('mongoose')
const {Schema} = mongoose

const reviewSchema = new Schema({
    productId: {
        type: Schema.Types.ObjectId,
        ref: 'Product',
        required: true
    },
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5
    },
    title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100
    },
    text: {
        type: String,
        required: true,
        trim: true,
        maxlength: 1000
    },
    helpfulVotes: {
        type: Number,
        default: 0
    },
    verifiedPurchase: {
        type: Boolean,
        default: false
    },
    isBlocked: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true })

// Compound index to ensure a user can only review a product once
reviewSchema.index({ productId: 1, userId: 1 }, { unique: true })

// Static method to calculate average rating for a product
reviewSchema.statics.getAverageRating = async function(productId) {
    const result = await this.aggregate([
        { $match: { productId: mongoose.Types.ObjectId(productId) } },
        { $group: { _id: null, averageRating: { $avg: "$rating" } } }
    ])
    return result[0]?.averageRating || 0
}

const Review = mongoose.model('Review', reviewSchema)
module.exports = Review