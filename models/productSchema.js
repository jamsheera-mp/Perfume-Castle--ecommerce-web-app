const mongoose = require('mongoose')
const {Schema} = mongoose

const productSchema = new Schema({
    productName:{
        type : String,
        required : true, 
        
    },
    description:{
        type : String,
        required : true 
    },
    highlights:{
        type : Array,
        required : false
    },
    brand:{
        type : Schema.Types.ObjectId,
        ref : 'Brand',
        required : false
    },
    category:{
        type : Schema.Types.ObjectId,
        ref : "Category",
        required : true 
    },
  
    salePrice:{
        type : Number,
        required : true
    },
   
   
    quantity:{
        type : Number,
        default : 0
    },
    ml:{
        type : [Number],
        required : true
    },
    productImage:{
        type : [String],
        required : true
    },
    isBlocked:{
        type : Boolean,
        default : false
    },
    isDeleted:{
        type : Boolean,
        default :  false

    },
    status:{
        type : String,
        enum : ["Available","Out of stock","Discontinued"],
        required : true,
        default : "Available"
    },
    popularity:{
        type:Number,
        default:0
    },
    averageRating:{
        type:Number,
        default:0
    },
    dateAdded: {
        type: Date,
        default: Date.now
    }
    
},{timestamps:true})

// Index for improved query performance
productSchema.index({ productName: 1, salePrice: 1, popularity: -1, averageRating: -1, dateAdded: -1 })

const Product = mongoose.model("Product",productSchema)
module.exports = Product