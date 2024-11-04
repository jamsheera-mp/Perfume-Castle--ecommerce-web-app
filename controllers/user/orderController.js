const mongoose = require('mongoose');
const Order = require('../../models/orderSchema');
const Cart = require('../../models/cartSchema');
const Product = require('../../models/productSchema');
const Address = require('../../models/addressSchema');
const User = require('../../models/userSchema');
const Wallet = require('../../models/walletSchema')
let Coupon = require('../../models/couponSchema')
const Razorpay = require('razorpay');
const crypto = require('crypto');





const getCheckout = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.redirect('/login');
        }

        const userId = req.session.user;
        const cart = await Cart.findOne({ userId }).populate('items.productId');
        const addresses = await Address.find({ userId });

        if (!cart || !cart.items || cart.items.length === 0) {
            return res.render('user/checkout', {
                cart: null,
                addresses,
                cartItems: [],
                message: 'Your cart is empty',
                appliedCoupon: null,
                couponCode: null,
                couponDiscount: 0
            });
        }

        // Calculate subtotal
        const subtotal = cart.items.reduce((total, item) => total + item.totalPrice, 0);

        // Get coupon information from session
        const appliedCoupon = req.session.appliedCoupon || null;
        let couponCode = null;
        let couponDiscount = 0;
        let total = subtotal;

        // If coupon is applied, calculate the discounted total
        if (appliedCoupon) {
            couponCode = appliedCoupon.couponCode;
            couponDiscount = appliedCoupon.discount;
            total = subtotal - couponDiscount;
        }

        res.render('user/checkout', {
            cart,
            addresses,
            cartItems: cart.items,
            subtotal,
            total,
            appliedCoupon: appliedCoupon ? true : false,
            couponCode,
            couponDiscount
        });

    } catch (error) {
        console.error('Error in getCheckout:', error);
        res.status(500).send('Error loading checkout page');
    }
};
//-------------------------------------------------------------
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});
//-------------------------------------------------------------------------
const placeOrder = async (req, res) => {
    try {
        console.log('Received order request:', req.body);

        const userId = req.session.user;
        const { address, paymentMethod } = req.body;

        console.log('User ID from session:', userId);
        //console.log('Address ID:', address);

        const userObjectId = new mongoose.Types.ObjectId(userId);
        const addressObjectId = new mongoose.Types.ObjectId(address);
        console.log('address object id:', addressObjectId);


        if (!userId || !paymentMethod || !addressObjectId) {
            return res.status(400).json({ success: false, message: 'Missing required information' });
        }

        const userAddress = await Address.findOne({
            userId: userObjectId,
            'address._id': addressObjectId
        });

        if (!userAddress) {
            console.log("Address not valid");
            return res.status(400).json({ success: false, message: 'Invalid address' });
        }

        const selectedAddress = userAddress.address.find(addr => addr._id.equals(addressObjectId));

        if (!selectedAddress) {
            console.log("Specific address not found in the array");
            return res.status(400).json({ success: false, message: 'Specific address not found' });
        }

        console.log("Valid address found:", selectedAddress);

        const cart = await Cart.findOne({ userId: userObjectId }).populate('items.productId');

        if (!cart || cart.items.length === 0) {
            return res.status(400).json({ success: false, message: 'Your cart is empty' });
        }

        // Check product availability
        const unavailableProducts = [];
        for (const item of cart.items) {
            const product = await Product.findById(item.productId._id);
            if (!product || product.quantity < item.quantity) {
                unavailableProducts.push({
                    name: item.productId.productName,
                    requested: item.quantity,
                    available: product ? product.quantity : 0
                });
            }
        }

        if (unavailableProducts.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Some products in your cart are out of stock',
                unavailableProducts
            });
        }

        const subtotal = cart.items.reduce((total, item) => total + (item.price * item.quantity), 0);

        console.log('Sub Total price:', subtotal);
        // Retrieve coupon details from session
        const appliedCoupon = req.session.appliedCoupon;
        let finalAmount = subtotal;

        if (appliedCoupon) {
            const coupon = await Coupon.findById(appliedCoupon.couponId);
            if (coupon) {
                finalAmount = subtotal - appliedCoupon.discount;
                // Mark coupon as used by this user
                coupon.userId.push(userId);
                await coupon.save();
            }
        }

        //Order above Rs 1000 should not be allowed for COD
        if(finalAmount > 1000 && paymentMethod === 'CashOnDelivery'){
            return res.status(400).json({success:false,message:'Order above Rs 1000 should not be allowed for COD'})
        }

        
        let initialStatus, initialPaymentStatus;
        if (paymentMethod === 'CashOnDelivery') {
            initialStatus = 'Placed';
            initialPaymentStatus = 'Pending';
        } else if (paymentMethod === 'Online') {
            initialStatus = 'Pending';
            initialPaymentStatus = 'Pending';
        } else {
            return res.status(400).json({ success: false, message: 'Invalid payment method' });
        }

        const newOrder = new Order({
            userId: userObjectId,
            orderedItems: cart.items.map(item => ({
                product: item.productId._id,
                name:item.productId.productName,
                image:item.productId.productImage[0],
                quantity: item.quantity,
                price: item.price
            })),
            totalPrice: subtotal,

            finalAmount: finalAmount,
            appliedCouponId: appliedCoupon ? appliedCoupon.couponId : null,
            address: {
                addressId: selectedAddress._id,
                parentAddressId: userAddress._id
            },
            status: initialStatus,
            paymentMethod: paymentMethod,
            paymentStatus: initialPaymentStatus,

        });
        let razorpayOrder;
        if (paymentMethod === 'Online') {
            razorpayOrder = await razorpay.orders.create({
                amount: finalAmount * 100,
                currency: 'INR',
                receipt: 'order_receipt_' + Date.now(),
                payment_capture: 1
            });
            newOrder.razorpayOrderId = razorpayOrder.id;
        }

        console.log('Before saving new order:', newOrder);
        await newOrder.save();
        console.log('After saving new order:', newOrder);

        // Clear session coupon after order is created
        delete req.session.appliedCoupon;

         // For COD orders,and paid orders update inventory and clear cart immediately
         if (paymentMethod === 'CashOnDelivery') {

            await Promise.all([
                ...cart.items.map(item =>
                    Product.findByIdAndUpdate(item.productId._id, {
                        $inc: { quantity: -item.quantity }
                    })
                ),
                Cart.findOneAndUpdate({ userId: userObjectId }, { $set: { items: [] } })
            ]);

            return res.status(200).json({
                success: true,
                message: 'Order placed successfully',
                orderId: newOrder._id
            });
        } else {
            
          
            // For online payment, return Razorpay order details
            return res.status(200).json({
                success: true,
                message: 'Razorpay order created',
                orderId: newOrder._id,
                razorpayOrderId: razorpayOrder.id,
                amount: finalAmount * 100,
                currency: 'INR'
            });
        }

    } catch (error) {
        console.error('Error placing order:', error);
        res.status(400).json({ success: false, message: 'Error placing order' });
    }
};

//------------------------------------------------------------------------------------------------
const updatePaymentStatus = async(req,res)=>{
    try {
        const { orderId, razorpayOrderId, status ,error} = req.body;
        
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ 
                success: false, 
                message: 'Order not found' 
            });
        }

        // Update order with payment failure details
        order.paymentStatus = status;
        order.status = status === 'Failed' ? 'Failed' : order.status;
        

        if (error) {
            order.paymentError = error;
        }
        // If there's an error message, store it
       // if (error) {
            //updates.paymentFailureReason = error;
       // }
        await  order.save();

        //////////////////////////////////////////
        //const updatedOrder = await Order.findOneAndUpdate(
            //{ _id: orderId },
            //{ $set: updates },
            //{ new: true }
        //);
        

        // If payment failed, restore product quantities
        //if (paymentStatus === 'Failed') {
           // await Promise.all(order.orderedItems.map(async (item) => {
               // await Product.findByIdAndUpdate(
                    //item.product,
                    //{ $inc: { quantity: item.quantity } }
               // );
           // }));
        //}
        /////////////////////////////////////////
        res. status(200).json({ 
            success: true, 
            message: 'Payment status updated successfully',
            //order: updatedOrder
        });
    } catch (error) {
        console.error('Error updating payment status:', error);
        res.status(500).json({ success: false, message: 'Failed to update payment status' });
    }
}

//----------------------------------------------------------------------------------------

const getOrderList = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.redirect('/login');
        }

        const page = parseInt(req.query.page) || 1;
        const limit = 10; // Number of orders per page
        const skip = (page - 1) * limit;

        const totalOrders = await Order.countDocuments({ userId: req.session.user._id });
        const totalPages = Math.ceil(totalOrders / limit);

        const orders = await Order.find({ userId: req.session.user._id })
            .sort({ createdAt: -1 }) // Sort by most recent first
            .skip(skip)
            .limit(limit)
            .populate('orderedItems.product', 'productName productImage');

        const formattedOrders = orders.map(order => ({
            ...order.toObject(),
            createdAt: order.createdAt.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            }),
            totalItems: order.orderedItems.reduce((sum, item) => sum + item.quantity, 0)
        }));

        res.render('user/orderList', {
            orders: formattedOrders,
            currentPage: page,
            totalPages: totalPages,
            user: req.session.user
        });

    } catch (error) {
        console.error('Error fetching order list:', error);
        req.flash('error', 'An error occurred while fetching your orders');
        res.redirect('/dashboard');
    }
};


const trackOrder = async (req, res) => {
    try {
        const userId = req.session.user
        // Check if user is logged in
        if (!userId) {
            return res.redirect('/login?redirect=' + encodeURIComponent(req.originalUrl));
        }

        const { orderId } = req.params;
        console.log('order id :', orderId);


        // Find the order for the current user
        const order = await Order.findOne({ orderId: orderId })
            .populate('orderedItems.product')
            .populate('address.parentAddressId')
            .populate('appliedCouponId');

        console.log("order:", order)

        if (!order) {
            console.log('order is not valid')
            return res.redirect('/orders');
        }
        // Find the specific address from the array
        const addressDocument = order.address.parentAddressId;
        const specificAddress = addressDocument.address.find(addr =>
            addr._id.toString() === order.address.addressId.toString()
        );

        if (!specificAddress) {
            console.error('Selected address not found');
            return res.redirect('/cart');
        }

        // Prepare order status history
        const statusHistory = [
            { status: 'Pending', date: formatDate(order.createdAt) },
        ];

        if (order.status === 'Confirmed') {
            statusHistory.push({ status: 'Confirmed', date: formatDate(order.confirmedAt) });
        }


        if (order.status === 'Shipped') {
            statusHistory.push({ status: 'Shipped', date: formatDate(order.shippedAt) });
        }

        if (order.status === 'Delivered') {
            statusHistory.push({ status: 'Delivered', date: formatDate(order.deliveredAt) });
        }

        const subtotal = order.totalPrice;
        const total = order.finalAmount;
        const orderedItems = order.orderedItems.map(item => ({
            productName: item.product.productName,
            productImage: item.product.productImage,
            quantity: item.quantity,
            price: item.price
        }));

        // Define the formatDate function
        function formatDate(dateString) {
            const date = new Date(dateString);
            return date.toLocaleString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: 'numeric',
                hour12: true
            });
        }

        res.render('user/trackOrder', {
            order,
            orderId: order.orderId,
            orderDate: formatDate(order.createdOn),
            orderStatus: order.status,
            orderedItems: orderedItems,
            statusHistory,
            shippingAddress: specificAddress,
            subtotal,
            total,
            formatDate
        });

    } catch (error) {
        console.error('Error tracking order:', error);
        res.redirect('/orders');
    }
};
const cancelOrder = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ success: false, message: 'User not authenticated' });
        }

        const { orderId } = req.params;
        const { reason } = req.body;
        const sessionUserId = req.session.user;

        console.log('Attempting to cancel order:', { orderId, sessionUserId, reason });

        const order = await Order.findOne({ orderId }).populate('address.parentAddressId');

        if (!order) {
            console.log('Order not found with orderId:', orderId);
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        console.log('Order found:', order);

        // Fetch the address document
        const addressDoc = await Address.findById(order.address.parentAddressId);

        if (!addressDoc) {
            console.log('Address not found for order:', orderId);
            return res.status(404).json({ success: false, message: 'Address not found for this order' });
        }

        // Check if the session user is the owner of the order
        if (!addressDoc.userId.equals(sessionUserId) && !req.session.isAdmin) {
            console.log('Order does not belong to the user:', { orderId, sessionUserId });
            return res.status(403).json({ success: false, message: 'Not authorized to cancel this order' });
        }

        if (order.status !== 'Placed' && order.status !== 'Pending' && order.status !== 'Processing' && order.status !== 'Confirmed') {
            console.log('Order cannot be cancelled. Current status:', order.status);
            return res.status(400).json({ success: false, message: 'Order cannot be cancelled' });
        }

        // Add refund amount to user's wallet
        
        // Handle refund for online payments
        if (order.paymentMethod !== 'CashOnDelivery' && order.razorpayOrderId) {
            try {
                const refundResult = await initiateRazorpayRefund(order.razorpayOrderId, order.finalAmount);
                if (refundResult.success) {
                    console.log('Refund initiated successfully:', refundResult);
                    order.paymentStatus = 'Refunded';
                } else {
                    console.error('Failed to initiate refund:', refundResult.error);
                    // Instead of returning an error, we'll add the amount to the wallet
                    await addToWallet(addressDoc.userId, order.finalAmount, `Refund for cancelled order ${orderId}`);
                    order.paymentStatus = 'Refunded';
                }
            } catch (refundError) {
                console.error('Error processing refund:', refundError);
                // Add to wallet in case of any error
                await addToWallet(addressDoc.userId, order.finalAmount, `Refund for cancelled order ${orderId}`);
                order.paymentStatus = 'Refunded';
            }
        } else if (order.paymentMethod !== 'CashOnDelivery') {
            // Add refund amount to user's wallet if it's not a COD order
            await addToWallet(addressDoc.userId, order.finalAmount, `Refund for cancelled order ${orderId}`);
            order.paymentStatus = 'Refunded';
        }

        // Update order status to Cancelled
        order.status = 'Cancelled';
        order.cancellationReason = reason;
        await order.save();

        console.log('Order status updated to Cancelled');

        // Restore product quantities
        await Promise.all(order.orderedItems.map(async (item) => {
            await Product.findByIdAndUpdate(
                item.product,
                { $inc: { quantity: item.quantity } }
            );
        }));

        console.log('Product quantities restored');

        res.status(200).json({ success:true,message: 'Order cancelled successfully' });
    } catch (error) {
        console.error('Error cancelling order:', error);
        res.status(500).json({ success:false,message: 'An error occurred while cancelling the order' });
    }
};

// Helper function to add amount to wallet
async function addToWallet(userId, amount, description) {
    let wallet = await Wallet.findOne({ userId });
    if (!wallet) {
        wallet = new Wallet({ userId });
    }
    wallet.balance += amount;
    wallet.transactions.push({
        type: 'credit',
        amount,
        description
    });
    await wallet.save();
    console.log('Refund added to wallet:', { userId, amount });
}
    async function initiateRazorpayRefund(razorpayOrderId, amount) {
        try {
            const payments = await razorpay.orders.fetchPayments(razorpayOrderId);
            // const payment = payments.items[0];

            const refund = await razorpay.payments.refund(payments.id, {
                amount: amount * 100, // Razorpay expects amount in paise
            });

            console.log('Refund initiated:', refund);
            return {
                success: true,
                refundId: refund.id,
                amount: refund.amount / 100, // Convert back to rupees
                status: refund.status
            };
        } catch (error) {
            console.error('Razorpay refund error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    const returnOrder = async (req, res) => {
        try {
            if (!req.session.user) {
                return res.status(401).json({ error: 'User not authenticated' });
            }

            const { orderId } = req.params;
            const { reason, action } = req.body;
            const userId = req.session.user;

            console.log('Attempting to process return for order:', { orderId, userId, reason, action });

            const order = await Order.findOne({ orderId }).populate('address.parentAddressId');

            if (!order) {
                console.log('Order not found with orderId:', orderId);
                return res.status(404).json({ error: 'Order not found' });
            }

            console.log('Order found:', order);

            // Fetch the address document
            const addressDoc = await Address.findById(order.address.parentAddressId);

            if (!addressDoc) {
                console.log('Address not found for order:', orderId);
                return res.status(404).json({ error: 'Address not found for this order' });
            }

            // Check if the session user is the owner of the order
            if (!addressDoc.userId.equals(userId) && !req.session.isAdmin) {
                console.log('Order does not belong to the user:', { orderId, userId });
                return res.status(403).json({ error: 'Not authorized to process return for this order' });
            }

            let newStatus;
            switch (action) {
                case 'request':
                    if (order.status !== 'Delivered') {
                        return res.status(400).json({ error: 'Order cannot be returned' });
                    }
                    newStatus = 'Return Request';
                    break;
                case 'approve':
                    if (order.status !== 'Return Request' || !req.session.isAdmin) {
                        return res.status(400).json({ error: 'Cannot approve return' });
                    }
                    newStatus = 'Returned';
                    break;
                case 'reject':
                    if (order.status !== 'Return Request' || !req.session.isAdmin) {
                        return res.status(400).json({ error: 'Cannot reject return' });
                    }
                    newStatus = 'Delivered';
                    break;
                default:
                    return res.status(400).json({ error: 'Invalid action' });
            }

            if (newStatus === 'Returned') {
                try {
                    if (order.paymentMethod === 'Online') {
                        // Initiate Razorpay refund
                        const refundResult = await initiateRazorpayRefund(order.razorpayOrderId, order.finalAmount);
                        if (refundResult.success) {
                            order.paymentStatus = 'Refund Pending';
                            order.refundId = refundResult.refundId;
                            console.log('Razorpay refund initiated:', { orderId, refundId: refundResult.refundId });
                        } else {
                            console.error('Failed to initiate Razorpay refund:', refundResult.error);
                            return res.status(500).json({ error: 'Failed to initiate refund' });
                        }
                    }

                    // Add refund amount to user's wallet (for both Online and COD)
                    let wallet = await Wallet.findOne({ userId: addressDoc.userId });
                    if (!wallet) {
                        wallet = new Wallet({ userId: addressDoc.userId });
                    }
                    wallet.balance += order.finalAmount;
                    wallet.transactions.push({
                        type: 'credit',
                        amount: order.finalAmount,
                        description: `Refund for returned order ${orderId}`
                    });
                    await wallet.save();

                    if (order.paymentMethod === 'CashOnDelivery') {
                        order.paymentStatus = 'Refunded';
                    }

                    console.log('Refund added to wallet:', { userId: addressDoc.userId, amount: order.finalAmount });

                    // Restore product quantities
                    await Promise.all(order.orderedItems.map(async (item) => {
                        await Product.findByIdAndUpdate(
                            item.product,
                            { $inc: { quantity: item.quantity } }
                        );
                    }));
                    console.log('Product quantities restored');
                } catch (refundError) {
                    console.error('Error processing refund:', refundError);
                    return res.status(500).json({ error: 'Failed to process refund' });
                }
            }

            // Update order status
            order.status = newStatus;
            if (action === 'request') {
                order.returnReason = reason;
            }
            await order.save();

            console.log('Order status updated to', newStatus);

            res.status(200).json({ message: `Return ${action === 'request' ? 'requested' : action + 'ed'} successfully` })
        } catch (error) {
            console.error('Error processing return:', error);
            res.status(500).json({ error: 'An error occurred while processing the return' });
        }
    };
    module.exports = {
        getCheckout,
        placeOrder,
        updatePaymentStatus,
       
        
        getOrderList,
        returnOrder,
        cancelOrder,
        trackOrder

    };