
const env = require('dotenv').config()
const Razorpay = require('razorpay');
const crypto = require('crypto');
const Product = require('../../models/productSchema')
const Cart = require('../../models/cartSchema')
const mongoose = require('mongoose')
const User = require('../../models/userSchema');
const Order = require('../../models/orderSchema');


const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

const createRazorpayOrder = async (req, res) => {
    try {
        const { orderId } = req.body;

        // Fetch the order details from your database
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        // Create Razorpay order
        const razorpayOrder = await razorpay.orders.create({
            amount: order.finalAmount * 100, // Razorpay expects amount in paise
            currency: 'INR',
            receipt: orderId,
            payment_capture: 1
        });

        // Update the order with Razorpay order ID
        order.razorpayOrderId = razorpayOrder.id;
        await order.save();

        // Fetch user details
        const user = await User.findById(order.userId);

        res.json({
            success: true,
            orderId: razorpayOrder.id,
            amount: razorpayOrder.amount,
            currency: razorpayOrder.currency,
            customerName: user.name,
            customerEmail: user.email,
            customerPhone: user.phone
        });
    } catch (error) {
        console.error('Error creating Razorpay order:', error);
        res.status(500).json({ success: false, message: 'Error creating Razorpay order' });
    }
};

const verifyRazorpayPayment2 = async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

        const generatedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest('hex');

        if (generatedSignature === razorpay_signature) {
            // Payment is successful
            const order = await Order.findOne({ razorpayOrderId: razorpay_order_id });
            if (!order) {
                return res.status(404).json({ success: false, message: 'Order not found' });
            }

            // Update order status and payment status
            order.paymentStatus = 'Paid';
            order.status = 'Confirmed';
            await order.save();

            res.json({ success: true, message: 'Payment verified successfully', orderId: order._id });
        } else {
            // If signature verification fails, update order status to 'Failed'
            const order = await Order.findOne({ razorpayOrderId: razorpay_order_id });
            if (order) {
                order.paymentStatus = 'Failed';
                order.status = 'Cancelled';
                await order.save();
            }

            res.status(400).json({ success: false, message: 'Invalid signature' });
        }
    } catch (error) {
        console.error('Error verifying Razorpay payment:', error);
        res.status(500).json({ success: false, message: 'Error verifying payment' });
    }
}


// Verify Razorpay payment controller
const verifyRazorpayPayment = async (req, res) => {
    try {
        const {
            razorpay_payment_id,
            razorpay_order_id,
            razorpay_signature,
            orderId
        } = req.body;

        // Find the order
        const order = await Order.findById(orderId)
            .select('userId paymentStatus status razorpayPaymentId orderedItems address')
            .populate({
                path: 'address.parentAddressId',
                select: 'UserId address'
            });


        if (!order) {
            console.log('Order not found:', orderId);
            return res.status(404).json({
                success: false,
                message: 'Order not found'
            });
        }
        // Get userId from the populated address
        const userId = order.address.parentAddressId.userId;
        const userObjectId = new mongoose.Types.ObjectId(userId);

        console.log('user:', userObjectId)
        console.log('Full order object:', order);
        console.log('Processing order:', order._id, 'for user:', userObjectId);

        // Verify signature
        const generatedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest('hex');

        if (generatedSignature === razorpay_signature) {

            console.log('Signature verified successfully');

            // Payment is verified successfully
            order.paymentStatus = 'Paid';
            order.status = 'Placed';
            order.razorpayPaymentId = razorpay_payment_id;
            await order.save();

            console.log('Order status updated to Paid');

            // Update inventory and clear cart only after successful payment

            try {
                // Update product quantities first
                console.log('Updating product quantities...');
                for (const item of order.orderedItems) {
                    await Product.findByIdAndUpdate(
                        item.product,
                        { $inc: { quantity: -item.quantity } }
                    );
                    console.log(`Updated quantity for product ${item.product}`);
                }

                // Then clear the cart
                console.log('Attempting to clear cart for user:', userObjectId);
                const cartResult = await Cart.findOneAndUpdate(
                    { userId: userObjectId },
                    { $set: { items: [] } },
                    { new: true }
                );

                if (!cartResult) {
                    console.log('Cart not found for user:',userObjectId);
                   
                } else {
                    console.log('Cart cleared successfully');
                }

                return res.status(200).json({
                    success: true,
                    message: 'Payment verified successfully',
                    orderId: order._id
                });
            } catch (updateError) {
                console.error('Error in inventory/cart update:', updateError);
                // Even if inventory/cart update fails, payment was still successful
                return res.status(200).json({
                    success: true,
                    message: 'Payment successful but inventory update needs attention',
                    orderId: order._id
                });
            }

        } else {

            console.log('Signature verification failed');

            // Signature verification failed
            order.paymentStatus = 'Failed';
            order.status = 'Failed';
            order.paymentError = 'Signature verification failed';
            await order.save();

            return res.status(400).json({
                success: false,
                message: 'Payment verification failed'
            });
        }

    } catch (error) {
        console.error('Error verifying payment:', error);
        res.status(500).json({
            success: false,
            message: 'Error processing payment verification'
        });
    }
};


module.exports = {
    createRazorpayOrder,
    verifyRazorpayPayment
}