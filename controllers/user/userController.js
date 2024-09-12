//Load home page
const loadHome = async (req,res)=>{
    try {
        return res.render('user/home')
    } catch (error) {
        console.log("home page not found",error.message

        );
        res.status(500).send('server error')
        
    }
}
//Load page not found
const pageNotFound = async (req,res) => {
    try {
        res.render("user/404")
        
    } catch (error) {
        res.redirect('/pageNotFound')
    }
    
}
//load login page
const loadLogin = async (req,res)=>{
    try {
        return res.render('user/login')
    } catch (error) {
        console.log("login page not found",error.message

        );
        res.status(500).send('server error')
        
    }
}
module.exports = {
    loadHome,
    pageNotFound,
    loadLogin
}