const mongoose = require('mongoose')
const {Schema} = mongoose

const cartSchema = new Schema({
   userId: {
    type: Schema.Types.ObjectId,
     ref: 'User',
     required : true
    },
    items:[{
        productId:{
            type:  Schema.Types.ObjectId,
            ref: 'Product',
            required :true
        },
        quantity:{
            type : Number,
            required: true,
            min:1
        },
        price:{
            type : Number,
            required : true
        },
        totalPrice:{
            type : Number,
            default:0,
            required : true
        },
        status:{
            type : String,
            enum:['placed','cancelled'],
            default : 'placed'
        },
        cancellationReason:{
            type : String,
            default : "null"
        }
    }],
    cartSubTotal: {
        type: Number,
        default: 0
      }
    
},{
    timestamps : true
})



// // Pre-save middleware to calculate totalPrice for each item and cartSubTotal
// cartSchema.pre('save', function(next) {
//     let subTotal = 0;
    
//     this.items.forEach(item => {
//       item.totalPrice = item.quantity * item.price;
//       subTotal += item.totalPrice;
//     });
  
//     this.cartSubTotal = subTotal;
//     next();
//   });
  

  
  
const Cart = mongoose.model('Cart',cartSchema)
module.exports = Cart