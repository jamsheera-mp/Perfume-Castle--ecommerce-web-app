
const env = require('dotenv').config()
const Razorpay = require('razorpay');
const crypto = require('crypto');



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

const verifyRazorpayPayment = async (req, res) => {
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

module.exports = {
    createRazorpayOrder,
    verifyRazorpayPayment
}