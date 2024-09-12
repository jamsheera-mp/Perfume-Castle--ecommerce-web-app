const express = require('express')

const app = express()
require('dotenv').config()
const connectDB = require('./config/db')
const path = require('path')
const userRoutes = require('./routes/userRoutes')

const PORT = process.env.PORT || 3000 //port
connectDB() //db

//parsing
app.use(express.json())
app.use(express.urlencoded({extended:true}))


//view engine set up


app.set('view engine','ejs')
app.set('views', path.join(__dirname, 'views'))

app.use(express.static('public')) //static files


//routes
app.use('/',userRoutes)

app.listen(PORT,()=>{
    console.log(`Server started on ${PORT}`);
    
})


module.exports = app