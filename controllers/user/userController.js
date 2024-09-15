const User = require('../../models/userSchema')
const { validationResult } = require('express-validator')
const nodemailer = require('nodemailer')
const env = require('dotenv').config()
const bcryptjs = require('bcryptjs')
//Load home page
const loadHome = async (req, res) => {
    try {
        const user = req.session.user
        if(user){
            const userData = await User.findOne({_id:req.session.user})
            res.render('user/home',{user:userData})
        }else{
            return res.render('user/home',{user:null})
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
//load login page

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
            
            return res.render('user/register', { message: "User with this email already exists"  })
        
            
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
        else{
            res.redirect('/')
        }
    } catch (error) {
        res.redirect('/pageNotFound')
        // console.log("login page not found", error.message);
        // res.status(500).send('server error')

    }
}
const login =async(req,res)=>{
    try {
        const {email,password} = req.body
        console.log(req.body);
        
        const findUser = await User.findOne({isAdmin:false,email:email})
        console.log(findUser);
        
        if(!findUser){
            return res.render('user/login',{message:'User not found'})
        }
        if(findUser.isBlocked){
            res.render('user/login',{message:'User is blocked'})
        }
        const  isValidPassword = await bcryptjs.compare(password,findUser.password)
        console.log(isValidPassword);
        
        if(!isValidPassword){
            return res.render('user/login',{message:'Invalid password'})

        }
        req.session.user = findUser._id
        res.redirect('/')

    } catch (error) {
        console.error('login error',error)
        res.render('user/login',{message:'Login failed,Try again later'})
    }
}
const logout =  async (req, res) => {
    try {
        req.session.destroy((err)=>{
            if(err){
                console.log("session destruction error",err)
                return res.redirect('pageNotFound')
            }
            return res.redirect('/login')
        })
    } catch (error) {
        console.log("Logout error",error);
        res.redirect('/pageNotFound')
        
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
    logout
}