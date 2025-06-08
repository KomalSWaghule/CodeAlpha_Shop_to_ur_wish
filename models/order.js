import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema({
  userId: { // Buyer ID
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
      createdBy: {  // Seller/Admin who added the product
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
    street: { type: String },
    city: { type: String },
    state: { type: String },
    zip: { type: String },
    country: { type: String }
  },

  createdAt: { 
    type: Date, 
    default: Date.now 
  }

}, { timestamps: true });

const Order = mongoose.model('Order', orderSchema);

export default Order;
