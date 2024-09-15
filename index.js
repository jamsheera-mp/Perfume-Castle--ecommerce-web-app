require('dotenv').config()
const express = require('express')
const session = require('express-session')
//const Swal = require('sweetalert2')
//const flash = require('connect-flash')
const passport = require('./config/passport')
const app = express()

const connectDB = require('./config/db')
const path = require('path')
const userRoutes = require('./routes/userRoutes')
const adminRoutes = require('./routes/adminRoutes')
const PORT = process.env.PORT || 3000 //port
connectDB() //db

// Middleware to parse form data
app.use(express.urlencoded({ extended: true }));
app.use(express.json()); 

//session
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie:{
        secure: false,
        httpOnly:true,
        maxAge: 1000 * 60 * 60 * 24 * 7 
    }

}))

//passport initialize
app.use(passport.initialize())
app.use(passport.session())


app.use((req,res,next)=>{
    res.set('cache-control','no-store')
    next()
})
app.use((req, res, next) => {
    res.locals.user = req.session.user || null; // Make 'user' available globally in all views
    next();
});


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