
const passport = require('passport')
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/userSchema')
const env = require('dotenv').config()


passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: 'http://localhost:3000/google/callback'

},
    async (accessToken, refreshToken, profile, done) => {
        try {
            let user = await User.findOne({ googleId: profile.id })
            if (user) {
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
            done(err, null)
        }
    }
))

passport.serializeUser((user, done) => {
    done(null, user.id)
})
passport.deserializeUser(async(id, done) => {
    const user = await User.findById(id)
    done(null,user)
})

module.exports = passport