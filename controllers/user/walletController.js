const Wallet = require('../../models/walletSchema');



const getWallet = async (req, res) => {
    try {
        const userId = req.session.user; // assuming session contains user id

        // Check if the wallet exists for the user
        let wallet = await Wallet.findOne({ userId }).lean();

        // If no wallet exists, create a new one with default balance
        if (!wallet) {
            // Creating a new wallet with default balance
            wallet = new Wallet({
                userId: userId,  // Assign the user ID
                balance: 0,      // Initial balance of 0
                transactions: [] // No transactions initially
            });

            await wallet.save(); // Save the wallet to the database
            console.log('New wallet created:', wallet);
        }

        res.render('user/wallet', { wallet });
    } catch (err) {
        console.error('Error fetching wallet:', err);
        res.status(500).render('user/wallet', { message: 'Error fetching wallet' });
    }
};
// Function to create or update wallet
const handleWalletTransaction = async (userId, amount, type, description) => {
    try {
        const wallet = await Wallet.findOne({ userId });
        
        if (wallet) {
            // Update existing wallet
            const newBalance = type === 'credit' 
                ? wallet.balance + amount 
                : wallet.balance - amount;
            
            // Ensure balance doesn't go below 0
            if (newBalance < 0) {
                throw new Error('Insufficient wallet balance');
            }

            wallet.balance = newBalance;
            wallet.transactions.push({
                type,
                amount,
                description,
                date: new Date()
            });
            
            return await wallet.save();
        } else {
            // Create new wallet
            const newWallet = new Wallet({
                userId,
                balance: amount,
                transactions: [{
                    type,
                    amount,
                    description,
                    date: new Date()
                }]
            });
            
            return await newWallet.save();
        }
    } catch (error) {
        console.error('Error handling wallet transaction:', error);
        throw error;
    }
};


module.exports = {
    getWallet,
    handleWalletTransaction
};
