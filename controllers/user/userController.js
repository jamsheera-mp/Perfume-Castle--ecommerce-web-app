const { calculateProductPrices } = require('../../middlewares/priceCalculator')

const mongoose = require('mongoose')

const User = require('../../models/userSchema')
const Category = require('../../models/categorySchema')
const Brand = require('../../models/brandSchema')
const Product = require('../../models/productSchema')
// const { validationResult } = require('express-validator')
const nodemailer = require('nodemailer')
const env = require('dotenv').config()
const bcryptjs = require('bcryptjs')
const Address = require('../../models/addressSchema')
const Order = require('../../models/orderSchema')
const Wallet = require('../../models/walletSchema')
const Coupon = require('../../models/couponSchema')

//Load home page
const loadHome = async (req, res) => {
    try {
        const user = req.session.user;
        const categories = await Category.find({ isListed: true }).lean();
        // Fetch basic data
        const [brands, products, userData] = await Promise.all([

            Brand.find({ isBlocked: false }).lean(),
            Product.find({
                isBlocked: false,
                category: { $in: categories.map(category => category._id) },
                quantity: { $gt: 0 }
            })
                .sort({ createdOn: -1 })
                .limit(50)
                .lean(),
            user ? User.findById(user).lean() : null
        ]);

        // Store products in request for middleware
        req.products = products;


        // Use Promise to properly handle the middleware
        await new Promise((resolve) => {
            calculateProductPrices(req, res, resolve);
        });
        const processedProducts = req.products;



        res.render('user/home', {
            user: userData,
            products: processedProducts, // Use processed products with offers
            categories: categories,
            brands: brands
        });

    } catch (error) {
        console.log("home page not found", error.message);
        res.status(500).send('server error');
    }
};
//Load page not found
const pageNotFound = async (req, res) => {
    try {
        return res.render("user/404")

    } catch (error) {
        console.log("Page not found error:", error.message);
        res.redirect('/pageNotFound')
    }

}


//Load register
const loadRegister = async (req, res) => {
    try {
        return res.render('user/register')
    } catch (error) {
        console.log("register page not found", error.message);
        res.status(500).send('server error')

    }
}
function generateOtp() {
    return Math.floor(100000 + Math.random() * 900000).toString();

}
async function sendEmail(email, otp) {
    console.log('Email to send OTP to:', email);
    try {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            port: 587,
            secure: false,
            requireTLS: true,
            auth: {
                user: process.env.NODEMAILER_EMAIL,
                pass: process.env.NODEMAILER_PASSWORD
            }
        })

        const info = await transporter.sendMail({
            from: process.env.NODEMAILER_EMAIL,
            to: email,
            subject: 'OTP for login',
            text: `Your OTP is ${otp}`,
            html: `<b>Your OTP: ${otp}</b>`
        })
        return info.accepted.length > 0


    } catch (error) {
        console.error("Error sending email,error", error)
        return false
    }
}
//------------------------------------------------------------------------------------
// Function to generate referral code
const generateReferralCode = async () => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const codeLength = 8;
    let referralCode;
    let isUnique = false;

    // Keep generating until we find a unique code
    while (!isUnique) {
        referralCode = '';
        for (let i = 0; i < codeLength; i++) {
            const randomIndex = Math.floor(Math.random() * characters.length);
            referralCode += characters[randomIndex];
        }

        // Check if code already exists
        const existingCode = await User.findOne({ referalCode: referralCode });
        if (!existingCode) {
            isUnique = true;
        }
    }

    return referralCode;
};
//------------------------------------------------------------------------------------
//// Function to handle referral rewards

const handleWalletTransaction = async (userId, amount, type, description) => {
    try {
        // Ensure userId is a valid ObjectId
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            throw new Error('Invalid user ID format');
        }
        //check if wallet exists for the user
        let wallet = await Wallet.findOne({ userId })
        if (!wallet) {
            //create a new wallet if doesn't exist
            wallet = await Wallet.create({
                userId,
                balance: 0,
                transactions: []
            })
        }

        //Add the new transaction to the wallet
        wallet.transactions.push({
            type,
            amount,
            description,
            date: new Date()
        })
        //Update the wallet balance
        // Update balance
        if (type === 'credit') {
            wallet.balance += amount;
        } else if (type === 'debit') {
            wallet.balance -= amount;
        }

        //Save the updated wallet
        await wallet.save()
        return wallet
    } catch (error) {
        console.error('Error in wallet transaction:', error);
        throw error;
    }

}


const handleReferralRewards = async (newUserId, referringUserId) => {
    try {
        console.log('Starting referral reward process for:', {
            newUserId,
            referringUserId
        });

          // Validate input parameters
          if (!newUserId || !referringUserId) {
            throw new Error('Missing required user IDs for referral reward');
        }

        // Verify both users exist before proceeding
        const [newUser, referringUser] = await Promise.all([
            User.findById(newUserId),
            User.findById(referringUserId)
        ]);

        if (!newUser || !referringUser) {
            throw new Error('One or both users not found');
        }
        console.log('Both users found, processing rewards');
        // Process rewards for both users in parallel
        const [referringUserWallet, newUserWallet] = await Promise.all([
            // Credit 100 rupees to the referring user's wallet
            handleWalletTransaction(
                referringUserId,
                100, // Changed to 100 rupees
                'credit',
                `Referral reward for inviting ${newUser.name}`
            ),
            // Credit 50 rupees to the new user's wallet
            handleWalletTransaction(
                newUserId,
                50,
                'credit',
                `Welcome bonus for joining through ${referringUser.name}'s referral`
            )
        ]);
        console.log('Wallet transactions completed:', {
            referringUserWallet: referringUserWallet?.balance,
            newUserWallet: newUserWallet?.balance
        });

        if (!referringUserWallet || !newUserWallet) {
            throw new Error('Failed to update one or both user wallets');
        }
         // Update the new user's referral status
         const updatedNewUser = await User.findByIdAndUpdate(
            newUserId,
            {
                $set: {
                    redeemed: true,
                    redeemedUsers: referringUserId
                }
            },
            { new: true }
        );
        return { updatedNewUser, referringUserWallet,newUserWallet };
    } catch (error) {
        console.error('Error handling referral rewards:', error);
        throw error;
    }

}

//-------------------------------------------------------------
const register = async (req, res) => {
    try {
        console.log('received registration data:', req.body)

        const { name, email, password, confirmPassword, phone, referredBy } = req.body


        //check passwords match
        if (password !== confirmPassword) {
            console.log('password mismatch');
            return res.status(400).json({ success: false, message: "passwords do not match" })
        }

        // Check if email already exists
        const findUser = await User.findOne({ email })
        //console.log('user found:',findUser)
        if (findUser) {
            console.log('user exists with email:',email)
            return res.status(400).json({ success: false, message: "User with this email already exists" })
        }

          // Generate unique referral code for new user
          const newUserReferralCode = await generateReferralCode();
          console.log('Generated new referral code:', newUserReferralCode);

        // If user was referred by someone, validate the referral code
        let referringUser = null;
        if (referredBy  && referredBy.trim() !== '') {
            console.log('Checking referral code:', referredBy);

            referringUser = await User.findOne({ referralCode: referredBy });
            console.log('referring user found:', referringUser);

            if (!referringUser) {
                console.log('Invalid referral code provided:', referredBy);
                return res.status(400).json({ success: false, message: "Invalid referral code" });
            }
             // Check if referring user is not the same as new user
             if (referringUser.email === email) {
                console.log('User tried to use their own referral code');
                return res.status(400).json({ 
                    success: false, 
                    message: "Cannot use your own referral code" 
                });
            }
        }

        //otp generation
        const otp = generateOtp()
        const emailSent = await sendEmail(email, otp)
        if (!emailSent) {
            return res.json({ success: false, message: "Failed to send OTP" })
        }
        req.session.userOtp = otp
        req.session.userData = {
            name,
            email,
            password,
            phone,
            referralCode:newUserReferralCode,
          }
         // Store referring user's ID in session if exists
         if (referringUser) {
            req.session.referringUserId = referringUser._id;
            console.log('Stored referring user ID in session:', referringUser._id);
        }

        console.log("OTP sent", otp);
        return res.json({ success: true, message: 'OTP sent successfully', redirectUrl: '/verify-otp' })

    }
    catch (error) {
        console.error("Error registering user", error.message)
        return res.status(500).json({ success: false, message: error.message || 'Registration failed' })
    }
}
const loadVerifyOtp = async (req, res) => {
    try {
        return res.render('user/verify-otp')
    } catch (error) {
        console.log("otp verify page not found", error.message);
        res.status(500).send('server error')
    }
}
const verifyOtp = async (req, res) => {
    try {
        const { otp } = req.body
        console.log('Received OTP:', otp);
        console.log('Session OTP:', req.session.userOtp);
        if (!otp) {
            return res.status(400).json({
                success: false,
                message: 'OTP is required'
            });
        }
        if (String(otp) !== String(req.session.userOtp)) {
            return res.status(400).json({ success: false, message: 'Invalid OTP' });
        }

        
            const userData = req.session.userData
            console.log('User in verify otp', userData)
            if (!userData) {
                return res.status(400).json({ success: false, message: 'User data not found in session' });
            }
            

            // Hash password using bcryptjs
            const salt = await bcryptjs.genSalt(10);
            const hashedPassword = await bcryptjs.hash(userData.password, salt)

            //create new user
            const newUser = new User({
                name: userData.name,
                email: userData.email,
                password: hashedPassword,
                phone: userData.phone,
                referralCode: userData.referralCode,
            })

            await newUser.save()
            req.session.user = newUser._id
            console.log('user after successful registration:', newUser)

            // Create initial wallet for new user with 0 balance
           const newUserWallet = await handleWalletTransaction(
                newUser._id,
                0,
                'credit',
                'Initial wallet creation'
            );


            // Update user with wallet reference
            newUser.wallet = newUserWallet._id;
            await newUser.save();
            console.log('wallet created for user')

         // Handle referral rewards if applicable
         if (req.session.referringUserId) {
            try {
                console.log('Processing referral rewards...');
                const rewardResult = await handleReferralRewards(newUser._id, req.session.referringUserId);
                console.log('Referral rewards processed:', rewardResult);
            } catch (error) {
                console.error('Error processing referral rewards:', error);
                
            }
        }

            // Clear session data
            delete req.session.userOtp;
            delete req.session.userData;
            delete req.session.referringUserId;

            return res.json({ success: true, redirectUrl: '/login' })

    
    } catch (error) {
        console.error('Error verifying OTP', error);
        return res.status(500).json({ success: false, message: "An error occured " })

    }
}
const resendOtp = async (req, res) => {
    try {
        const { email } = req.session.userData
        if (!email) {
            return res.status(400).json({ success: false, message: "Email not found in session" })
        }
        const otp = generateOtp()
        req.session.userOtp = otp

        const emailSent = await sendEmail(email, otp)
        if (emailSent) {
            console.log("resend otp:", otp);
            res.status(200).json({
                success: true,
                message: "OTP resent successfully",
            })
        } else {
            res.status(500).json({ success: false, message: "Failed to resend OTP,Try again" })
        }
    } catch (error) {
        console.error('Error resending OTP', error)
        res.status(500).json({ success: false, message: "An error occured " })
    }
}
const loadLogin = async (req, res) => {
    try {
        if (!req.session.user) {

            return res.render('user/login')
        }
        else {
            res.redirect('/')
        }
    } catch (error) {
        res.redirect('/pageNotFound')
        // console.log("login page not found", error.message);
        // res.status(500).send('server error')

    }
}
const login = async (req, res) => {
    try {

        const { email, password } = req.body
        console.log(req.body);

        const findUser = await User.findOne({ isAdmin: false, email: email })
        console.log(findUser);

        if (!findUser) {
            return res.render('user/login', { message: 'User not found' })
        }
        if (findUser.isBlocked) {
            res.render('user/login', { message: 'User is blocked' })
        }
        const isValidPassword = await bcryptjs.compare(password, findUser.password)
        console.log(isValidPassword);

        if (!isValidPassword) {
            return res.render('user/login', { message: 'Invalid password' })

        }
        req.session.user = findUser._id
        //guest user cart want to store in db
        // await cartController.mergeGuestCartWithUserCart(req,req.user);
        res.redirect('/')

    } catch (error) {
        console.error('login error', error)
        res.render('user/login', { message: 'Login failed,Try again later' })
    }
}
const logout = async (req, res) => {
    try {
        req.session.destroy((err) => {
            if (err) {
                console.error('Error destroying session:', err);
                return res.status(500).json({ success: false, message: 'Logout failed' });
            }
            res.redirect('/login')
        })
    } catch (error) {
        console.log("Logout error", error);
        res.status(500).json({ success: false, message: 'An error occurred during logout' });


    }
}


//profile mgmt-----------------------------------------------------------------------------------------------------------------------

const loadProfile = async (req, res) => {
    try {

        const userId = req.session.user
        const user = await User.findById(userId)
        const wallet = await Wallet.findOne({ userId })

        const addresses = await Address.find({ userId: userId })
        // Collect all address IDs of the user
        const addressIds = addresses.map(address => address._id);

        // Find orders associated with the user's addresses
        const orders = await Order.find({ 'address.parentAddressId': { $in: addressIds } }).populate('orderedItems.product').sort({ createdAt: -1 });

         // Find available coupons that are not expired
         const currentDate = new Date();
         const coupons = await Coupon.find({ isList: true, expireOn: { $gt: currentDate } });
         console.log('coupons available:', coupons);


        console.log('Orders:', orders);
        console.log('Addresses:', addresses)
        if (!user) {
            return res.status(404).render('user/404', { message: "User not found" });
        }

        res.render('user/profile', {
            user,
            referralCode: user.referralCode,
            walletBalance: wallet ? wallet.balance : 0,
            walletTransactions: wallet ? wallet.transactions.reverse() : [],
            addresses,
            orders,
            coupons
        });

    } catch (error) {
        console.error('Error loading profile page:', error);
        res.redirect('/pageNotFound')
    }
}
//---------------------------------------------------------------------------------------------------------------------
//load address page
const loadAddresses = async (req, res) => {
    try {
        const userId = req.session.user
        const user = await User.findById(userId)

        const addresses = await Address.find({ userId }).populate('userId')
        console.log('User', user);


        res.render('user/addresses', { user, addresses })

    } catch (error) {
        console.log('address page loading errors:', error);
        res.redirect('/pageNotFound')

    }
}


//Add New Address
const addAddress = async (req, res) => {
    try {
        const userId = req.session.user;
        console.log('User Id:', userId);

        const user = await User.findById(userId);

        if (!user) {
            console.log('User not found')
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        const { name, phone, pincode, city, landMark, district, state, altPhone, addressType } = req.body;
        console.log('Received address data:', { name, phone, pincode, city, landMark, district, state, altPhone, addressType });

        // Create the new address object
        const newAddress = {
            name,
            phone,
            pincode,
            city,
            landMark,
            district,
            state,
            addressType,
            ...(altPhone && { altPhone })
        };

        // Find the existing address document or create a new one
        let addressDoc = await Address.findOne({ userId });

        if (addressDoc) {
            // Check for duplicate address
            const isDuplicate = addressDoc.address.some(addr =>
                addr.name === name &&
                addr.city === city &&
                addr.pincode === pincode &&
                addr.landMark === landMark
            );

            if (isDuplicate) {
                return res.status(400).json({
                    success: false,
                    message: 'This address already exists'
                });
            }

            // Add the new address to the existing document
            addressDoc.address.push(newAddress);
        } else {
            // Create a new address document
            addressDoc = new Address({
                userId,
                address: [newAddress]
            });
        }

        // Save with validation
        const savedAddress = await addressDoc.save();
        console.log('Saved address:', savedAddress);

        res.status(200).json({
            success: true,
            message: 'Address added successfully',
            addresses: savedAddress.address
        });

    } catch (error) {
        console.error('Error saving address:', error);

        // Handle validation errors specifically
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                success: false,
                message: 'Validation error',
                errors: Object.values(error.errors).map(err => err.message)
            });
        }

        res.status(500).json({
            success: false,
            message: 'Error saving address. Please try again.'
        });
    }
};
//Edit address
const editAddress = async (req, res) => {
    try {
        const addressId = req.params.id;
        const userId = req.session.user;

        const { name, phone, pincode, city, landMark, district, state, addressType } = req.body;


        // Update the address fields in the array
        const updateResult = await Address.updateOne(
            { userId, 'address._id': addressId },
            {
                $set: {
                    'address.$.name': name,
                    'address.$.phone': phone,
                    'address.$.pincode': pincode,
                    'address.$.city': city,
                    'address.$.landMark': landMark,
                    'address.$.district': district,
                    'address.$.state': state,
                    'address.$.addressType': addressType
                }
            }
        );

        if (updateResult.modifiedCount === 0) {
            return res.status(404).send({ success: false, message: 'Address update failed.' });
        }
        //req.session.save()
        res.json({ success: true, message: 'Address updated successfully.' })

    } catch (error) {
        console.error('Error updating address:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });

    }
}
// delete address
const deleteAddress = async (req, res) => {
    try {
        const userId = req.session.user;
        const addressId = req.params.addressId;


        const result = await Address.updateOne(
            { userId: userId },
            { $pull: { address: { _id: addressId } } }
        );
        console.log('Result:', result);

        if (result.modifiedCount === 0) {
            return res.status(404).json({ success: false, message: 'Address not found' });
        }

        return res.status(200).json({ success: true, message: 'Address deleted successfully' });
    } catch (error) {
        console.error('Error deleting address:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};
const updateProfile = async (req, res) => {
    try {
        const userId = req.session.user;
        const { name, email } = req.body;

        // Update user in database
        await User.findByIdAndUpdate(userId, { name, email });

        res.json({ success: true });
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({ success: false, message: 'Error updating profile' });
    }
}

module.exports = {
    loadHome,
    pageNotFound,
    loadLogin,
    loadRegister,
    register,
    loadVerifyOtp,
    verifyOtp,
    resendOtp,
    login,
    loadProfile,
    loadAddresses,

    addAddress,
    updateProfile,

    editAddress,
    deleteAddress,
    logout,

}