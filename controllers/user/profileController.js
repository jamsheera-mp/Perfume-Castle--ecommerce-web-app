const User = require('../../models/userSchema')
const nodemailer = require('nodemailer')
const env = require('dotenv').config()
const bcryptjs = require('bcryptjs')
const session = require('express-session')



//forgot Password
const getForgotPassword = async(req,res)=>{
    try {
        res.render('user/forgotPassword')
    } catch (error) {
        res.redirect('/pageNotFound')
    }
}
async function sendEmail(email, otp) {
    console.log('Email to send OTP :', email);
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
        const mailOptions ={
            from:process.env.NODEMAILER_EMAIL,
            to:email,
            subject:"Your OTP for Password Reset",
            text:`Your OTP is ${otp}`,
            html: `<b>Your OTP: ${otp}</b>`
        }
        
        const info = await transporter.sendMail(mailOptions)
        console.log('Email sent',info.messageId);
        return true
        


    } catch (error) {
        console.error("Error sending email,error", error)
        return false
    }
}
const passwordReset = async(req,res)=>{
try {
    const {email } = req.body
    console.log("Recieved email:",email);
    
    const findUser = await User.findOne({email:email})
    console.log('found user:',findUser);
    
    if(findUser){
        const otp = generateOtpForPasswordReset()
        const emailSent = await sendEmail(email, otp)
        console.log('emailsent:',emailSent)
        if(emailSent){
            req.session.userOtp = otp
            req.session.email = email

            console.log('session updated:',req.session); 
            console.log('Attempting to render verifyOtpForPwd');
            
            //console.log('otp:',otp);
            res.render('user/verifyOtpForPwd')
            
            

        }else{
            console.log('Failed to send OTP');
            
            res.json({success:false,message:'Failed to send otp,please try again'})
        }
    }else{
        console.log('User not found');
        
         return res.render('user/forgotPassword',{
            message:'User with this email does not exist.'
        })
    }
    
} catch (error) {
    console.log('Error in passwordReset:',error);
    
   return res.json({success:'false',message:'An error occured',error:error.message})
}
}
function generateOtpForPasswordReset(){
    const digits = "1234567890"
    let otp =""
    for(let i=0;i<6;i++){
        otp+=digits[Math.floor(Math.random()*10)]
    }
    return otp
}

const verifyPwdForgotOTP = async(req,res)=>{
    try {
        const enteredOtp = req.body.otp
        if(enteredOtp === req.session.userOtp){
            res.json({success:'true',redirectUrl:'/reset-password'})
        }else{
            res.json({success:'false',message:'OTP not matching'})
        }
        
    } catch (error) {
        res.status(500).json({success:'false',message:'An error occured while sending otp'})
    }
}
const getResetPwdPage = async(req,res)=>{
    try {
        res.render('user/reset-pwd-page')
    } catch (error) {
        console.log('error loading reset pwd page',error);
        
    }
}
const resendOtp = async(req,res)=>{
    try {
        const otp = generateOtpForPasswordReset()
        req.session.userOtp = otp
        const email = req.session.email
        console.log('resending otp to email:',email,otp);
        const emailSent = await sendEmail(email,otp)
        if(emailSent){
            console.log('Resend otp:',otp);
            res.status(200).json({success:'true',message:'Resend OTP successfull'})
            
        }
        
    } catch (error) {
        console.log('Error in resend otp:',error);
        res.status(500).json({success:'false',message:'Internal server error'})
        
    }
}
const securePassword = async(password)=>{
    try {
        const passwordHash = await bcryptjs.hash(password,10)
        return passwordHash
    } catch (error) {
        
    }
}
const postNewPwd = async(req,res)=>{
    try {
        const {newPwd1,newPwd2} = req.body
        const email = req.session.email
        if (!email) {
            return res.status(400).render('user/reset-pwd-page', { message: 'Email not found in session.' });
        }
        if(newPwd1 === newPwd2){
            const passwordHash = await securePassword(newPwd1)
            await User.updateOne(
                {email:email},
                {$set:{password:passwordHash}}
            )
            res.redirect('/login')
        }else{
            res.render('user/reset-pwd-page',{message:'Password do not match'})
        }
    } catch (error) {
        console.log('Error occured while resetting password');
        res.status(500).render('user/reset-pwd-page', { message: 'Internal server error.' });
    }
}

const cahngePassword = async (req,res)=>{
    
        const { currentPassword, newPassword } = req.body;
        const userId = req.session.user;
    
        try {
            const user = await User.findById(userId);
            if (!user) {
                return res.json({ success: false, message: 'User not found' });
            }
    
            // Verify current password
            const isMatch = await bcryptjs.compare(currentPassword, user.password);
            if (!isMatch) {
                return res.json({ success: false, message: 'Current password is incorrect' });
            }
    
            // Hash new password and update
            const hashedPassword = await bcryptjs.hash(newPassword, 10);
            user.password = hashedPassword;
            await user.save();
    
            res.json({ success: true, message: 'Password changed successfully' });
        } catch (error) {
            console.error(error);
            res.json({ success: false, message: 'An error occurred' });
        }
    }
module.exports ={

    getForgotPassword,
    passwordReset,
    verifyPwdForgotOTP ,
    getResetPwdPage,
    resendOtp,
    postNewPwd,
    cahngePassword
}