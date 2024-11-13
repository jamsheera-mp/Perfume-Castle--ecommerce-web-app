require('dotenv').config()
const express = require('express')
const session = require('express-session')
const MongoStore = require('connect-mongo');
const passport = require('./config/passport')
//const helmet = require("helmet")
const categoryBrandMiddleware = require('./middlewares/categoriesLoad')
const cartMiddleware = require('./middlewares/cart')
const wishlistMiddleware = require('./middlewares/wishlist')



const app = express()

const connectDB = require('./config/db')
const path = require('path')
const userRoutes = require('./routes/userRoutes')
const adminRoutes = require('./routes/adminRoutes')

const PORT = process.env.PORT || 3001 //port
connectDB() //db

// Middleware to parse form data
app.use(express.urlencoded({ extended: true }));
app.use(express.json()); 

//session
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    store: MongoStore.create({
        mongoUrl: process.env.MONGODB_URI , 
        ttl: 7 * 24 * 60 * 60, // 1 week (time to live in seconds)
    }),
    cookie: {
        secure: false, // Set true if using HTTPS
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24 * 7 // 1 week in milliseconds
    }
}));


//passport initialize
app.use(passport.initialize())
app.use(passport.session())
//app.use(helmet())

app.use((req,res,next)=>{
    res.set('cache-control','no-store')
    next()
})
app.use((req, res, next) => {
    res.locals.user = req.session.user || null; // Make 'user' available globally in all views
    next();
});
app.use(categoryBrandMiddleware);
app.use(cartMiddleware);
app.use(wishlistMiddleware)



//view engine set up
app.set('view engine','ejs')
app.set('views', path.join(__dirname, 'views'))

app.use(express.static('public')) //static files


//routes
app.use('/',userRoutes)
app.use('/admin',adminRoutes)


app.listen(PORT,()=>{
    console.log(`Server started on ${PORT}`);
    
})


module.exports = app
