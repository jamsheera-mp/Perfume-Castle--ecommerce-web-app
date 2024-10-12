const mongoose = require('mongoose');
const { Schema } = mongoose;

const addressSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    address: [{
        addressType: {
            type: String,
            required: true,
            enum: ['Home', 'Work']
        },
        name: {
            type: String,
            required: true,
            trim: true
        },
        city: {
            type: String,
            required: true,
            trim: true
        },
        landMark: {
            type: String,
            required: true,
            trim: true
        },
        district: {
            type: String,
            required: true,
            trim: true
        },
        state: {
            type: String,
            required: true,
            trim: true
        },
        pincode: {
            type: String, // Changed from Number to String
            required: true,
            trim: true,
            validate: {
                validator: function(v) {
                    return /^\d{6}$/.test(v);
                },
                message: props => `${props.value} is not a valid pincode!`
            }
        },
        phone: {
            type: String,
            required: true,
            trim: true,
            validate: {
                validator: function(v) {
                    return /^\d{10}$/.test(v);
                },
                message: props => `${props.value} is not a valid phone number!`
            }
        },
        altPhone: {
            type: String,
            required: false,
            trim: true,
            validate: {
                validator: function(v) {
                    return !v || /^\d{10}$/.test(v);
                },
                message: props => `${props.value} is not a valid phone number!`
            }
        }
    }]
}, {
    timestamps: true
});

const Address = mongoose.model("Address", addressSchema);
module.exports = Address;