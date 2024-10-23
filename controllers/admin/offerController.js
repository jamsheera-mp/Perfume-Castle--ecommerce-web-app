const Offer = require('../../models/offerSchema');
const Category = require('../../models/categorySchema')
const getAllOffers = async (req, res) => {
    try {
      const offers = await Offer.find();
      res.json(offers);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching offers' });
    }
  };
  
  const addOffer = async (req, res) => {
    try {
      const newOffer = new Offer(req.body);
      console.log('new offer:',newOffer);
      
      await newOffer.save();
      res.json(newOffer);
    } catch (error) {
      console.log('offer adding error',error);
      res.status(500).json({ message: 'Error adding offer' });
    }
  };
  
 const updateOffer = async (req, res) => {
    try {
      const updatedOffer = await Offer.findByIdAndUpdate(req.params.id, req.body, { new: true });
      res.json(updatedOffer);
    } catch (error) {
      res.status(500).json({ message: 'Error updating offer' });
    }
  };
  
const deleteOffer = async (req, res) => {
    try {
      await Offer.findByIdAndDelete(req.params.id);
      res.json({ message: 'Offer deleted successfully' });
    } catch (error) {
      res.status(500).json({ message: 'Error deleting offer' });
    }
  };
  
  const renderOfferPage =async (req, res) => {
    try{
        const categories = await Category.find()
    res.render('admin/offers',{ categories: JSON.stringify(categories) });
    }catch(error){
      
      
        res.status(500).json({ message: 'Error rendering offer page' });
    }
    
  };

  module.exports ={
    getAllOffers,
    addOffer,
    updateOffer,
    deleteOffer,
    renderOfferPage
  }