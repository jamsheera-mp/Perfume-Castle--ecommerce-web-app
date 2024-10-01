const User = require('../../models/userSchema')
const Category = require('../../models/categorySchema')
const Product = require('../../models/productSchema')
const { validationResult } = require('express-validator')
const nodemailer = require('nodemailer')
const env = require('dotenv').config()
const bcryptjs = require('bcryptjs')
const Address = require('../../models/addressSchema')
const cartController = require('../../controllers/user/cartController')
//Load home page
const loadHome = async (req, res) => {
    try {
        const user = req.session.user
        const categories = await Category.find({ isListed: true })
        let products = await Product.find({
            isBlocked: false,
            category: { $in: categories.map(category => category._id) },
            quantity: { $gt: 0 }
        }).sort({ createdOn: -1 }).limit(50)



        if (user) {
            const userData = await User.findOne({ _id: user })
            res.render('user/home', { user: userData, products, categories })
        } else {
            return res.render('user/home', { products, categories })
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
        await cartController.mergeGuestCartWithUserCart(req,req.user._id);
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
                console.log("session destruction error", err)
                return res.redirect('pageNotFound')
            }
            return res.redirect('/login')
        })
    } catch (error) {
        console.log("Logout error", error);
        res.redirect('/pageNotFound')

    }
}


//profile mgmt

const loadProfile = async (req, res) => {
    try {

        const userId = req.session.user
        const user = await User.findById(userId)
        if (!user) {
            return res.status(404).render('user/404', { message: "User not found" });
        }

        res.render('user/profile', { user });
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
        const user = await User.findById(userId)
        const { name, phone, pincode, city, landMark, district, state, altPhone, addressType } = req.body;

        // Create a new address object
        const newAddress = {
            name,
            phone,
            pincode,
            city,
            landMark,
            district,
            state,
            altPhone,
            addressType
        };
        console.log('new address:', newAddress);
        // Check if the same address already exists
        const existingAddress = await Address.findOne({
            userId,
            'address.name': name,
            // 'address.city': city,
            // 'address.pincode': pincode,
            // 'address.landMark': landMark
        });

        if (existingAddress) {
            // If an identical address already exists, skip adding it
            return res.status(400).send('This address already exists.');
        }

        // Find the user and update their address array
        await Address.findOneAndUpdate(
            { userId }, // Find the document with this userId
            { $push: { address: newAddress } }, // Push the new address into the address array
            { new: true, upsert: true } // Create the document if it doesn't exist
        );

        // Retrieve all addresses for the user to display
        const addresses = await Address.find({ userId }).populate('userId');
        req.session.save()

        // Render the addresses view with all addresses
        res.render('user/addresses', { user, addresses });
    } catch (error) {
        console.error('Error saving address:', error);
        res.redirect('/pageNotFound');
    }
};

//Edit address
const editAddress = async (req, res) => {
    try {
        const addressId = req.params.id;
        const userId = req.session.user; //store the user ID in session

        const { name, phone, pincode, city, landMark, district, state, addressType } = req.body;

        // Validate input data
        if (!name || !phone || !pincode || !city || !landMark || !district || !state || !addressType) {
            return res.status(400).send('Invalid input data');
        }

        // Retrieve user document
        const user = await User.findById(userId);

        // Update the address fields in the array
        const updateResult = await Address.updateOne(
            { userId, 'address._id': addressId }, // Find the specific user and address by ID
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
            return res.status(404).send('Address update failed.');
        }
        req.session.save()

        // Redirect to the addresses management page after successful update
        res.redirect('/address')
    } catch (error) {
        console.error('Error updating address:', error);
        res.redirect('/pageNotFound');
    }
}
// delete address
const deleteAddress = async (req, res) => {
    try {
        const userId = req.session.user; // Get the user ID from the session or request
        const addressId = req.params.addressId; // The ID of the address to delete from the URL parameters

        // Find the address document for the user
        const addressDocument = await Address.findOne({ userId: userId });
        if (!addressDocument) {
            return res.status(404).json({ success: false, message: 'Address document not found' });
        }

        // Ensure the address array exists
        if (!Array.isArray(addressDocument.address) || addressDocument.address.length === 0) {
            return res.status(400).json({ success: false, message: 'No addresses found' });
        }
        console.log('User ID:', userId);
        console.log('Address Document:', addressDocument);
        console.log('Address ID to delete:', addressId);

        // Find the index of the address to be deleted
        const addressIndex = addressDocument.address.findIndex(a => a._id.toString() === addressId);

        // If the address is not found, return an error
        if (addressIndex === -1) {
            return res.status(404).json({ success: false, message: 'Address not found' });
        }

        // Remove the address at the found index
        addressDocument.address.splice(addressIndex, 1);

        // Save the updated address document
        await addressDocument.save();

        return res.status(200).json({ success: true, message: 'Address deleted successfully' });
    } catch (error) {
        console.error('Error deleting address:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

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

    editAddress,
    deleteAddress,
    logout
}