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

module.exports = {
    getWallet
};
