const express = require('express')
const app = express()
require('dotenv').config()
const connectDB = require('./config/db')

const PORT = process.env.PORT || 3000

//database called
connectDB()

app.listen(PORT,()=>{
    console.log(`Server started on ${PORT}`);
    
})


module.exports = app