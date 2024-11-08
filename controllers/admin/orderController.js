const Order = require('../../models/orderSchema');
const Product = require('../../models/productSchema'); 

const listOrders = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const status = req.query.status;
        const search = req.query.search || '';
        const sortBy = req.query.sortBy || 'createdAt';
        const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;

        let query = {};
        if (status && status !== 'Show all') {
            query.status = status;
        }
        if (search) {
            query.$or = [
                { orderId: new RegExp(search, 'i') },
                { 'address.userId.name': new RegExp(search, 'i') },
                { 'address.userId.email': new RegExp(search, 'i') }
            ];
        }

        const totalOrders = await Order.countDocuments(query);
        const totalPages = Math.ceil(totalOrders / limit);

        const orders = await Order.find(query)
            .sort({ [sortBy]: sortOrder })
            .skip((page - 1) * limit)
            .limit(limit)
            .populate({
                path: 'address.parentAddressId',
                populate: {
                    path: 'userId',
                    select: 'name email'
                }
            })
            .populate('orderedItems.product')
            .lean();

        const transformedOrders = orders.map(order => ({
            _id: order._id,
            orderId: order.orderId,
            totalPrice: order.totalPrice,
            finalAmount: order.finalAmount,
            status: order.status,
            paymentMethod: order.paymentMethod,
            paymentStatus: order.paymentStatus,
            createdAt: order.createdAt,
            userId: {
                name: order.address?.parentAddressId?.userId?.name || 'Unknown User',
                email: order.address?.parentAddressId?.userId?.email || 'No Email'
            }
        }));
        
        res.render('admin/orderList', {
            orders: transformedOrders,
            currentPage: page,
            totalPages,
            totalOrders,
            status,
            search,
            sortBy,
            sortOrder: req.query.sortOrder || 'desc'
        });
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).render('admin/error', { error: 'Server Error' });
    }
};

const updateOrderStatus = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { status } = req.body;

        const order = await Order.findByIdAndUpdate(orderId, { status }, { new: true });

        if (!order) {
            return res.redirect('/admin/orders');
        }

        res.redirect('/admin/orders');
    } catch (error) {
        console.error('Error updating order status:', error);
        res.status(500).redirect('/admin/orders');
    }
};

const cancelOrderAndUpdateStock = async (req, res) => {
    try {
        const { orderId } = req.params;
        const order = await Order.findById(orderId).populate('orderedItems.product');

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // Revert the product quantities in stock
        for (const item of order.orderedItems) {
            await Product.findByIdAndUpdate(item.product._id, {
                $inc: { quantity: item.quantity }
            });
        }

        order.status = 'Cancelled';
        await order.save();

        res.redirect('/admin/orders');
    } catch (error) {
        console.error('Error cancelling order and updating stock:', error);
        res.status(500).redirect('/admin/orders');
    }
};

const getOrderDetails = async (req, res) => {
    try {
        const { orderId } = req.params;
        const order = await Order.findById(orderId)
            .populate({
                path: 'address.parentAddressId',
                populate: {
                    path: 'userId',
                    select: 'name email'
                }
            })
            .populate({
                path: 'orderedItems.product',
                select: 'productName price productImage category'
            })
            .lean();

        if (!order) {
            return res.redirect('/admin/orders');
        }
        // Find the correct address from the array
        const deliveryAddress = order.address.parentAddressId.address.find(
            addr => addr._id.toString() === order.address.addressId.toString()
        );
        const formattedDateTime = new Date(order.createdAt).toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: 'numeric',
            hour12: true
        });
        
        const safeOrder = {
            ...order,
            deliveryAddress,
            formattedDateTime,
            orderedItems: order.orderedItems.map(item => ({
                ...item,
                productImage: item.image ? [item.image] : [],  // Wrap single image in array
                productName: item.name,
                price: item.price,
                quantity: item.quantity,
                product: {
                    ...item.product,
                    category: item.product?.category || 'Unknown Category'
                }
            }))
        };

        res.render('admin/orderDetails', { order: safeOrder });
    } catch (error) {
        console.error('Error fetching order details:', error);
        res.status(500).redirect('/admin/orders');
    }
};


module.exports = {
    listOrders,
    updateOrderStatus,
    cancelOrderAndUpdateStock,
    getOrderDetails,
    
};