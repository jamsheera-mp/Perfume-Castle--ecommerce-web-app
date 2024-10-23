const LedgerEntry = require('../../models/ledgerEntrySchema');
const Order = require('../../models/orderSchema'); 
const Category = require('../../models/categorySchema')

const ledgerController = {
    // Generate ledger entries from orders
    generateLedgerFromOrders: async () => {
        try {
            const orders = await Order.find({ status: { $ne: 'Cancelled' } })
                .sort({ createdOn: 1 });

            let balance = 0;
            for (const order of orders) {
                balance += order.finalAmount;

                await LedgerEntry.create({
                    date: order.createdOn,
                    transactionType: 'SALE',
                    description: `Order #${order._id}`,
                    referenceNo: order._id.toString(),
                    credit: order.finalAmount,
                    debit: 0,
                    balance: balance,
                    category: 'Sales',
                    paymentMethod: order.paymentMethod,
                    notes: `Customer: ${order.userId}`
                });
            }
        } catch (error) {
            console.error('Error generating ledger:', error);
            throw error;
        }
    },

    // Get ledger entries with filtering and pagination
    getLedgerEntries: async (req, res) => {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 50;
            const startDate = req.query.startDate ? new Date(req.query.startDate) : null;
            const endDate = req.query.endDate ? new Date(req.query.endDate) : null;
            const transactionType = req.query.transactionType;
            const category = req.query.category;

            let query = {};

            if (startDate && endDate) {
                query.date = { $gte: startDate, $lte: endDate };
            }
            if (transactionType) {
                query.transactionType = transactionType;
            }
            if (category) {
                query.category = category;
            }

            const entries = await LedgerEntry.find(query)
                .populate('category','name')
                .sort({ date: -1, _id: -1 })
                .skip((page - 1) * limit)
                .limit(limit);

            const total = await LedgerEntry.countDocuments(query);

            // Calculate totals for the filtered period
            const totals = await LedgerEntry.aggregate([
                { $match: query },
                {
                    $group: {
                        _id: null,
                        totalDebit: { $sum: '$debit' },
                        totalCredit: { $sum: '$credit' },
                        finalBalance: { $last: '$balance' }
                    }
                }
            ]);
             // Fetch all active categories for the dropdown
             const categories = await Category.find({ 
                isListed: true, 
                isDeleted: false 
            }).sort('name');


            res.render('admin/ledger', {
                entries,
                categories,
                totals: totals[0] || { totalDebit: 0, totalCredit: 0, finalBalance: 0 },
                currentPage: page,
                totalPages: Math.ceil(total / limit),
                filters: {
                    startDate,
                    endDate,
                    transactionType,
                    category
                }
            });
        } catch (error) {
            console.error('Error fetching ledger:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    // Add new ledger entry manually
    addLedgerEntry: async (req, res) => {
        try {
            const {
                date,
                transactionType,
                description,
                referenceNo,
                debit,
                credit,
                category,
                paymentMethod,
                notes
            } = req.body;

             // Validate if category exists
             const categoryExists = await Category.findById(category);
             if (!categoryExists || !categoryExists.isListed || categoryExists.isDeleted) {
                 return res.status(400).json({ error: 'Invalid category' });
             }
 
            // Get the latest balance
            const lastEntry = await LedgerEntry.findOne()
                .sort({ date: -1, _id: -1 });
            
            const previousBalance = lastEntry ? lastEntry.balance : 0;
            const newBalance = previousBalance + (credit - debit);

            const entry = await LedgerEntry.create({
                date: new Date(date),
                transactionType,
                description,
                referenceNo,
                debit,
                credit,
                balance: newBalance,
                category,
                paymentMethod,
                notes
            });
              // Populate category before sending response
            await entry.populate('category', 'name');

            res.json({ success: true, entry });
        } catch (error) {
            console.error('Error adding ledger entry:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    },

    // Export ledger to Excel
    exportLedger: async (req, res) => {
        try {
            const startDate = req.query.startDate ? new Date(req.query.startDate) : null;
            const endDate = req.query.endDate ? new Date(req.query.endDate) : null;

            let query = {};
            if (startDate && endDate) {
                query.date = { $gte: startDate, $lte: endDate };
            }

            const entries = await LedgerEntry.find(query)
                .sort({ date: 1, _id: 1 });

            const excel = require('excel4node');
            const wb = new excel.Workbook();
            const ws = wb.addWorksheet('Ledger');

            // Add headers
            const headers = ['Date', 'Type', 'Description', 'Reference', 'Debit', 'Credit', 'Balance', 'Category', 'Payment Method', 'Notes'];
            headers.forEach((header, idx) => {
                ws.cell(1, idx + 1).string(header);
            });

            // Add data
            entries.forEach((entry, idx) => {
                const row = idx + 2;
                ws.cell(row, 1).date(entry.date);
                ws.cell(row, 2).string(entry.transactionType);
                ws.cell(row, 3).string(entry.description);
                ws.cell(row, 4).string(entry.referenceNo);
                ws.cell(row, 5).number(entry.debit);
                ws.cell(row, 6).number(entry.credit);
                ws.cell(row, 7).number(entry.balance);
                ws.cell(row, 8).string(entry.category);
                ws.cell(row, 9).string(entry.paymentMethod);
                ws.cell(row, 10).string(entry.notes || '');
            });

            const fileName = `ledger_${startDate ? startDate.toISOString().split('T')[0] : 'all'}_to_${endDate ? endDate.toISOString().split('T')[0] : 'present'}.xlsx`;
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);

            wb.write(fileName, res);
        } catch (error) {
            console.error('Error exporting ledger:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
};

module.exports = ledgerController;