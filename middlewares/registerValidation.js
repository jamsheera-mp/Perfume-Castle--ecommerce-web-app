
const { body, validationResult } = require('express-validator')


//validation rules for registration
const validateRegistration = [
    body('name')
        .notEmpty().withMessage('Name is required')
        .matches(/^[A-Za-z\s]{2,20}$/).withMessage('Name must be between 2 and 20 characters and contain only letters'),
    
        body('email')
    .trim()
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Please enter a valid email'),
    
        body('password')
        .notEmpty().withMessage('Password is required')
        .isLength({ min: 4, max: 20 }).withMessage('Password must be between 4 and 20 characters long'),
    
        body('confirmPassword')
        .notEmpty().withMessage('Confirm Password is required')
        .custom((value, { req }) => {
            if (value !== req.body.password) {
                throw new Error('Password do not match')
            }
            return true
        }),
        
        
        body('phone')
        .notEmpty().withMessage('Phone number is required')
        .matches(/^\d{10}$/).withMessage('Please enter a valid 10 digit phone numberr'),

        body('referredBy')
        .optional()
        .trim()
      

]


//middleware to handle validation results
const handleValidationErrors = (req,res,next)=>{
    const errors = validationResult(req)
    if(!errors.isEmpty()){
        return res.status(400).json({
            success:false,
            errors: errors.array()[0].msg
        })
    }
    next()
}

module.exports = {validateRegistration, handleValidationErrors}