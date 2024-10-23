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

//Load home page
const loadHome = async (req, res) => {
    try {
        const user = req.session.user
        const categories = await Category.find({ isListed: true })
        const brands = await Brand.find({ isBlocked: false })
        let products = await Product.find({
            isBlocked: false,
            category: { $in: categories.map(category => category._id) },
            quantity: { $gt: 0 }
        }).sort({ createdOn: -1 }).limit(50)





        if (user) {
            const userData = await User.findById(user)
            res.render('user/home', { user: userData, products, categories, brands })
        } else {
            return res.render('user/home', { products, categories, brands, })
        }

    } catch (error) {
        console.log("home page not found", error.message);
        res.status(500).send('server error')

    }
}
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
const register = async (req, res) => {
    try {
        console.log("Form data submitted: ", req.body);
        const { name, email, password, confirmPassword } = req.body
        console.log("Email provided: ", email);
        if (password !== confirmPassword) {
            console.log(password);

            return res.render('user/register', { message: "passwords do not match" })
        }
        // Check if email already exists
        const findUser = await User.findOne({ email })
        if (findUser) {
            console.log(findUser);

            return res.render('user/register', { message: "User with this email already exists" })


        }


        //otp generation
        const otp = generateOtp()
        const emailSent = await sendEmail(email, otp)
        if (!emailSent) {
            return res.json("email-error")
        }
        req.session.userOtp = otp
        req.session.userData = { name, email, password }

        console.log("OTP sent", otp);
        res.json({ success: true, redirectUrl: '/verify-otp' })

    }
    catch (error) {

        console.error("Error registering user", error)
        res.status(500).json({ success: false, errors: ["Registration failed"] })
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
        console.log(otp);
        if (otp === req.session.userOtp) {
            const user = req.session.userData
            // Hash password using bcryptjs
            const salt = await bcryptjs.genSalt(10);
            const hashedPassword = await bcryptjs.hash(user.password, salt)
            //const  hashedPassword = await securePassword(user.password)

            const saveUserData = new User({
                name: user.name,
                email: user.email,
                password: hashedPassword

            })
            await saveUserData.save()
            req.session.user = saveUserData._id
            res.json({ success: true, redirectUrl: '/login' })


        } else {
            res.status(400).json({ success: false, message: 'Invalid OTP,please try again' })
        }

    } catch (error) {
        console.error('Error verifying OTP', error);
        res.status(500).json({ success: false, message: "An error occured " })

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
        const user = req.session.user
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
        const addresses = await Address.find({ userId: userId })
        // Collect all address IDs of the user
        const addressIds = addresses.map(address => address._id);

        // Find orders associated with the user's addresses
        const orders = await Order.find({ 'address.parentAddressId': { $in: addressIds } }).populate('orderedItems.product');

        
        console.log('Orders:', orders);
        console.log('Addresses:',addresses)
        if (!user) {
            return res.status(404).render('user/404', { message: "User not found" });
        }

        res.render('user/profile', { user, addresses, orders });
    } catch (error) {
        console.error('Error loading profile page:', error);
        res.redirect('/pageNotFound')
    }
}
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
        console.log('User Id:',userId);
        
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