const mongoose = require('mongoose')
const env = require('dotenv').config()


const connectDB = async ()=>{
    try {

         await mongoose.connect(process.env.MONGODB_URL)
         console.log("Database connected");
         
        
    } catch (error) {
        console.log("Database connection error",error.message);
        process.exit(1)
    }
}

module.exports = connectDB