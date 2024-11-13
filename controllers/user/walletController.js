const Wallet = require('../../models/walletSchema');



const getWallet = async (req, res) => {
    try {
        const userId = req.session.user; 

       
        let wallet = await Wallet.findOne({ userId }).lean();

        if (!wallet) {
            // Creating a new wallet with default balance
          const newWallet = new Wallet({
                userId: userId,  
                transactions: [{
                    type: 'credit',
                    amount: 0,
                    description: 'Initial wallet creation'
                }]
            });

            wallet = (await newWallet.save()).toObject(); 
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
