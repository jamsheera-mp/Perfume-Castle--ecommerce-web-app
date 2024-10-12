const mongoose = require('mongoose');
const Order = require('../../models/orderSchema');
const Cart = require('../../models/cartSchema');
const Product = require('../../models/productSchema');
const Address = require('../../models/addressSchema');
const User = require('../../models/userSchema');

const getCheckout = async (req, res) => {
    try {
        console.log('User:', req.session.user);
        if (!req.session.user) {
            return res.redirect('/login');
        }

        const userId = req.session.user;
        const cart = await Cart.findOne({ userId }).populate('items.productId');
        console.log("cart:", cart);
        // console.log(cart.items)

        const addresses = await Address.find({ userId });

        if (!cart || !cart.items || cart.items.length === 0) {
            return res.render('user/checkout', { cart: null, addresses, cartItems: [], message: 'Your cart is empty' });
        }

        res.render('user/checkout', { cart, addresses, cartItems: cart.items });
    } catch (error) {
        console.error('Error in getCheckout:', error);
        res.status(500).send('Error loading checkout page');
    }
};

const placeOrder = async (req, res) => {
    try {
        console.log('Received order request:', req.body);


        const userId = req.session.user;
        const { address, paymentMethod } = req.body;

        console.log('User ID from session:', userId);
        console.log('Address ID:', address);
        
        if (!userId) {
            return res.status(401).json({ success: 'false', message: 'Please login to continue' })
        }

        if (!paymentMethod) {
            return res.status(400).json({ success: false, message: 'Payment method is required' });
        }
        if (!address) {
            return res.status(400).json({ success: false, message: 'Address is required' });
        }


        // Convert string IDs to ObjectIds
        const userObjectId = new mongoose.Types.ObjectId(userId);
        const addressObjectId = new mongoose.Types.ObjectId(address);

        // Check if the address exists and belongs to the current user
        const userAddress = await Address.findOne({
            userId: userObjectId,
            'address._id': addressObjectId
        });


        if (!userAddress) {
            console.log("address not valid");

            return res.status(400).json({ success: false, message: 'Invalid address' });
        }
        // Find the specific address in the array
        const selectedAddress = userAddress.address.find(addr => addr._id.equals(addressObjectId));


        if (!selectedAddress) {
            console.log("Specific address not found in the array");
            return res.status(400).json({ success: false, message: 'Specific address not found' });
        }

        console.log("Valid address found:", selectedAddress);


        const cart = await Cart.findOne({ userId: userObjectId }).populate('items.productId')

        if (!cart || cart.items.length === 0) {
            return res.status(400).json({ success: false, message: 'Your cart is empty' })
        }


        // Check product availability for all items in cart
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

        // If any products are unavailable, return error with details
        if (unavailableProducts.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Some products in your cart are out of stock',
                unavailableProducts
            });
        }

        const totalPrice = cart.items.reduce((total, item) => total + (item.price * item.quantity), 0);

        console.log('Totalprice:', totalPrice);



        const newOrder = new Order({
            userId: userObjectId,
            orderedItems: cart.items.map(item => ({
                product: item.productId._id,
                quantity: item.quantity,
                price: item.price
            })),
            totalPrice,
            finalAmount: totalPrice,

            address: {
                addressId: selectedAddress._id,
                parentAddressId: userAddress._id
            },
            status: 'Pending',
            paymentMethod: paymentMethod,
            paymentStatus: paymentMethod === 'CashOnDelivery' ? 'Pending' : 'Paid'
        });

        await newOrder.save();
        console.log("new order:", newOrder);

        // Update product quantities
        await Promise.all(cart.items.map(item =>
            Product.findByIdAndUpdate(
                item.productId._id,
                { $inc: { quantity: -item.quantity } }
            )
        ));

        // Clear the user's cart
        await Cart.findOneAndUpdate({ userId: userObjectId }, { $set: { items: [] } });

        // Update user's orderHistory
        await User.findByIdAndUpdate(userObjectId, { $push: { orderHistory: newOrder._id } });

        // res.status(200).json({ message: 'Order placed successfully', orderId: newOrder._id });

        req.session.orderId = newOrder._id;

        return res.status(200).json({
            success: true,
            message: 'Order placed successfully',
            orderId: newOrder._id
        })

    } catch (error) {
        console.error('Error placing order:', error);
        res.status(400).json({ success: false, message: 'Error placing order' });
    }
};

const getOrderSuccess = async (req, res) => {
    try {
        const orderId = req.session.orderId

        const order = await Order.findById(orderId)
        .populate('orderedItems.product')
        .populate('address.parentAddressId')



        if (!order) {
            return res.redirect('/cart');
        }

        console.log('order details', order);

        // Find the specific address from the array
        const addressDocument = order.address.parentAddressId;
        const specificAddress = addressDocument.address.find(addr => 
            addr._id.toString() === order.address.addressId.toString()
        );

        if (!specificAddress) {
            console.error('Selected address not found');
            return res.redirect('/cart');
        }

        const orderedItems = order.orderedItems.map(item => ({
            productName: item.product.productName,
            productImage: item.product.productImage,
            quantity: item.quantity,
            price: item.price
        }));

        const subtotal = order.totalPrice;
        const total = order.finalAmount;

        res.render('user/orderSuccess', {
            orderId: order.orderId,
            orderDate: order.createdOn,
            orderStatus: order.status,
            orderedItems: orderedItems,
            subtotal,
            total,
            shippingAddress:specificAddress
        });

    } catch (error) {
        console.error('Order success page loading error:', error);
        return res.redirect('/cart');
    }
};
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

const cancelOrder = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ error: 'User not authenticated' });
        }

        const { orderId } = req.params;
        const userId = req.session.user; // Ensure this is set correctly during authentication

        console.log('Attempting to cancel order:', { orderId, userId });

        // Find the order directly using orderId
        const order = await Order.findOne({ orderId });

        if (!order) {
            console.log('Order not found with orderId:', orderId);
            return res.status(404).json({ error: 'Order not found' });
        }

        console.log('Order found:', order);

        // Check if the order belongs to the user
        const userAddress = await Address.findOne({ _id: order.address.parentAddressId, userId: userId });

        if (!userAddress) {
            console.log('Order does not belong to the user:', { orderId, userId });
            return res.status(403).json({ error: 'Order does not belong to this user' });
        }

        // Check if the order can be cancelled
        if (order.status !== 'Pending' && order.status !== 'Processing') {
            console.log('Order cannot be cancelled. Current status:', order.status);
            return res.status(400).json({ error: 'Order cannot be cancelled' });
        }

        // Update order status to Cancelled
        order.status = 'Cancelled';
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

        res.status(200).json({ message: 'Order cancelled successfully' });
    } catch (error) {
        console.error('Error cancelling order:', error);
        res.status(500).json({ error: 'An error occurred while cancelling the order' });
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

        // Find the order for the current user
        const order = await Order.findOne({orderId:orderId})
        .populate('orderedItems.product')
        .populate('address.parentAddressId')

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


        if (order.status === 'Shipped') {
            statusHistory.push({ status: 'Shipped', date:formatDate(order.shippedAt)});
        }

        if (order.status === 'Delivered') {
            statusHistory.push({ status: 'Delivered', date: formatDate(order.deliveredAt)});
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

module.exports = {
    getCheckout,
    placeOrder,
    getOrderSuccess,
    getOrderList,
    
    cancelOrder,
    trackOrder

};