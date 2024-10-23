const mongoose = require('mongoose');

const ledgerEntrySchema = new mongoose.Schema({
    date: {
        type: Date,
        required: true,
        default: Date.now
    },
    transactionType: {
        type: String,
        required: true,
        enum: ['SALE', 'PURCHASE', 'EXPENSE', 'REFUND', 'OTHER']
    },
    description: {
        type: String,
        required: true
    },
    referenceNo: {
        type: String,
        required: true
    },
    debit: {
        type: Number,
        default: 0
    },
    credit: {
        type: Number,
        default: 0
    },
    balance: {
        type: Number,
        required: true
    },
    category: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        required: true
    },
    paymentMethod: {
        type: String,
        required: true,
        enum: ['CASH', 'CARD', 'UPI', 'BANK_TRANSFER', 'OTHER']
    },
    notes: String,
    attachments: [{
        filename: String,
        path: String
    }]
});

module.exports = mongoose.model('LedgerEntry', ledgerEntrySchema);
