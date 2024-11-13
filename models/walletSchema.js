const mongoose = require('mongoose');

const walletSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    balance: {
        type: Number,
        default: 0,
        min: 0
    },
    transactions: [{
        type: {
            type: String,
            enum: ['credit', 'debit'],
            required: true
        },
        amount: {
            type: Number,
            required: true
        },
        description: String,
        date: {
            type: Date,
            default: Date.now
        }
    }]
}, { timestamps: true });



// Add middleware to recalculate balance before saving
walletSchema.pre('save', function(next) {
    // Recalculate balance based on all transactions
    this.balance = this.transactions.reduce((acc, transaction) => {
        return transaction.type === 'credit' 
            ? acc + transaction.amount 
            : acc - transaction.amount;
    }, 0);
    next();
});





const Wallet = mongoose.model('Wallet', walletSchema);

module.exports = Wallet;