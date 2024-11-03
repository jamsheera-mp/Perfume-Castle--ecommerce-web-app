
const passport = require('passport')
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/userSchema')
require('dotenv').config()


passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: 'http://localhost:3000/google/callback',
    passReqToCallback: true

},
    async (req, accessToken, refreshToken, profile, done) => {
        try {
            let user = await User.findOne({ googleId: profile.id })
            if (user) {
                // If user exists, update google ID if not already set
                if (!user.googleId) {
                    user.googleId = profile.id;
                    await user.save();
                }
                return done(null, user)
            }
            user = new User({
                name: profile.displayName,
                email: profile.emails[0].value,
                googleId: profile.id

            })
            await user.save()
            done(null, user)
        } catch (error) {
            console.log('Google Auth Error:',error)
            done(error, null)
        }
    }
))

passport.serializeUser((user, done) => {
    done(null, user.id)
})
passport.deserializeUser(async(id, done) => {
    try {
        const user = await User.findById(id)
        done(null, user)
    } catch (error) {
        console.error('Deserialization Error:', error)
        done(error, null)
    }
})

module.exports = passport