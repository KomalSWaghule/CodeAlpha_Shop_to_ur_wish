
import mongoose from 'mongoose';

const reviewstructure = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  comment: {
    type: String,
    trim: true,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Productstructure = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },

  description: {
    type: String,
    required: true,
    trim: true
  },

  price: {
    type: Number,
    required: true,
    min: 0
  },

  image: {
    type: String, 
    required: false
  },

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  createdAt: {
    type: Date,
    default: Date.now
  },
     category: {
  type: String,
  required: true,
  trim: true
},
  reviews: [reviewstructure], 

  averageRating: {
    type: Number,
    default: 0
  },

  numReviews: {
    type: Number,
    default: 0
  }
});

const Product = mongoose.model('Product', Productstructure);

export default Product;
