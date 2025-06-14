import mongoose from 'mongoose';

const orderstructure = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  products: [
    {
      product: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Product', 
        required: true 
      },
      name: { 
        type: String, 
        required: true 
      },
      price: { 
        type: Number, 
        required: true, 
        min: 0 
      },
      quantity: { 
        type: Number, 
        required: true, 
        min: 1 
      },
      createdBy: {  
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      }
    }
  ],

  total: { 
    type: Number, 
    required: true,
    min: 0 
  },

  status: {
    type: String,
    enum: ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'],
    default: 'Pending'
  },

  shippingAddress: {
    street: { type: String ,required:true},
    city: { type: String ,required:true},
    state: { type: String ,required:true},
    zip: { type: String ,required:true },
    country: { type: String  ,required:true}
  },

  createdAt: { 
    type: Date, 
    default: Date.now 
  }
  

}, { timestamps: true });

const Order = mongoose.model('Order', orderstructure);

export default Order;
