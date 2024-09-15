const { check, validationResult } = require("express-validator");
const User = require("../../models/userSchema");
const mongoose = require("mongoose");

const registerValidation = [
  // Name validation
  check("name")
    .trim()
    .notEmpty().withMessage("Name is required")
    .isLength({ min: 2, max: 20 }) .withMessage("Name must be between 2 and 20 characters")
    .matches(/^[A-Za-z\s]+$/).withMessage("Name must contain only letters"),

  // Email validation
  check("email")
    .trim()
    .notEmpty()
    .withMessage("Email is required")
    .normalizeEmail()
    .isEmail()
    .withMessage("Must be a valid email")
    .custom(async (email) => {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        throw new Error("Email in use");
      }
    }),

  //Password validation
  check("password")
    .trim()
    .notEmpty()
    .withMessage("Password is required")
    .isLength({ min: 4, max: 20 })
    .withMessage("Password must be atleast 4 characters long")
    .withMessage("Must be between 4 and 20 characters"),

  //password confirmation
  check("confirmPassword")
    .trim()
    .notEmpty()
    .withMessage("This field is required")
    .isLength({ min: 4, max: 20 })
    .custom((passwordConfirmation, { req }) => {
      if (passwordConfirmation !== req.body.password) {
        throw new Error("Passwords must match");
      }
      return true;
    }),
  (req, res, next) => {
    next();
  },
];

module.exports = registerValidation;
