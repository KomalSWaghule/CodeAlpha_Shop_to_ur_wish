import express from 'express';
const router = express.Router();

import Product from '../models/product.js';

import Cart from '../models/cart.js';
import Order from '../models/order.js';
import User from '../models/User.js';

import bcrypt from 'bcrypt';
import multer from 'multer';


export function getUserId(req) {
  return req.session?.userId || null;
}


router.get('/profile', (req, res) => {
const userId = req.session?.userId;
if (!userId) return res.redirect('/login');

  
  res.send(`Your user ID is ${userId}`);
});


const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, './uploads/'); 
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname); 
  }
});

const upload = multer({ storage: storage });



function authorizeRoles(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.session.role)) {
      return res.status(403).send('Access denied');
    }
    next();
  };
}

function isAdmin(req, res, next) {
  if (req.session.role !== 'admin') return res.status(403).send('Admin only');
  next();
}

function isSeller(req, res, next) {
  if (req.session.role !== 'seller') return res.status(403).send('Seller only');
  next();
}

function isUser(req, res, next) {
  if (req.session.role !== 'user') return res.status(403).send('User only');
  next();
}



router.get('/', async (req, res) => {
  const products = await Product.find();
  const userId = req.session.userId || null;
  const role = req.session.role || null;

  let userOrders = [];
  if (userId) {
    userOrders = await Order.find({ userId })
      .populate('products.product', 'name price') 
      .sort({ createdAt: -1 });
  }

  res.render('index', {
    products,userId,role,
    user: req.session.user,
    userOrders
  });
});

 



router.get('/register', (req, res) => {
  res.render('register'); 
});

router.post('/register', async (req, res) => {
  try {
    const { username, password, role } = req.body;

    let userRole = role || 'user';
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      userRole = 'admin';
    }

    const user = new User({
      username: username.trim(),
      password,  
      role: userRole
    });

    await user.save();

   
    req.session.userId = user._id.toString();
    req.session.role = user.role;

    res.redirect('/'); 

  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).render('register', { error: 'Failed to register user. Try again.' });
  }
});

router.use(async (req, res, next) => {
  if (req.session?.userId) {
    try {
      const user = await User.findById(req.session.userId);
      if (user) {
        req.user = user;
      } else {
        req.user = null;
      }
    } catch (err) {
      console.error('Failed to load user from session:', err);
      req.user = null;
    }
  } else {
    req.user = null;
  }
  next();
});

function isAuthenticated(req, res, next) {
  if (req.user) {
    return next();
  }
  res.status(401).send('User not authenticated');
}



router.get('/login', (req, res) => {
  res.render('login'); 
});


router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Trim username to avoid trailing spaces issues
    const user = await User.findOne({ username: username.trim() });
    if (!user) {
      return res.status(401).render('login', { error: 'Invalid username or password' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).render('login', { error: 'Invalid username or password' });
    }

  
    req.session.userId = user._id.toString();
    req.session.role = user.role;

  
    res.redirect('/');
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).render('login', { error: 'Server error. Please try again.' });
  }
});



async function rehashPassword(username, newPassword) {
  const user = await User.findOne({ username });
  if (!user) {
    console.log('User not found');
    return;
  }
  user.password = newPassword;
  await user.save(); 
  console.log('Password rehashed successfully');
}


router.get('/reset-password', (req, res) => {
  res.render('reset-password');  
});


router.post('/reset-password', async (req, res) => {
  const { username, newPassword } = req.body;

  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).send('User not found');
    }

    user.password = newPassword; 
    await user.save();

    res.send('Password reset successful. You can now log in with your new password.');
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).send('Server error');
  }
});


router.get('/addproduct', authorizeRoles('admin', 'seller'), (req, res) => {
  res.render('addproduct'); 
});


function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
}

router.post('/addproduct', upload.single('image'), async (req, res) => {
  try {
    const { name, price, description, imageUrl, category } = req.body;
    let imagePath;

    if (req.file) {
      imagePath = req.file.path;
    } else if (imageUrl) {
      imagePath = imageUrl;
    } else {
      throw new Error('No image file or URL provided');
    }

    const createdBy = req.session.userId;
    if (!createdBy) {
      throw new Error('User not authenticated. Cannot set createdBy.');
    }

    if (!category) {
      throw new Error('Category is required');
    }

    const formattedCategory = capitalizeFirstLetter(category.trim());

    const newProduct = new Product({
      name,price,description,
      image: imagePath,
      createdBy, category: formattedCategory
    });

    const savedProduct = await newProduct.save();

    res.redirect(`/product/${savedProduct._id}`);

  } catch (error) {
    console.error('Error adding product:', error);
    res.status(500).send('Product creation failed');
  }
});

router.get('/product/:id', async (req, res) => {
  try {
    const productId = req.params.id;
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).send('Product not found');
    }
    res.render('product', { product, userId: req.session.userId, role: req.session.role });
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
});

router.get('/products', async (req, res) => {
  const { type } = req.query;
  try {
    const filter = type ? { category: type } : {};
    const products = await Product.find(filter);
    res.json(products);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server Error');
  }
});


router.post('/products/:id/reviews', isAuthenticated, async (req, res) => {
  const { rating, comment } = req.body;
  const productId = req.params.id;

  const product = await Product.findById(productId);
  if (!product) return res.status(404).send('Product not found');

  product.reviews.push({
    user: req.session.userId,
    rating,
    comment
  });

  await product.save();
  res.redirect('/product/' + productId); 
});

router.get('/some-route', async (req, res) => {
  const userId = req.session.userId;  

  const orders = await Order.find({
    'products.owner': userId
  }).populate('product.product');


});

router.post('/createOrder', async (req, res) => {
  const { products, userId, shippingAddress } = req.body; 
  
  let orderProducts = [];
  let totalPrice = 0;

  for (const item of products) {
    const product = await Product.findById(item.productId);
    if (!product) return res.status(404).send('Product not found');

    orderProducts.push({
      product: product._id,
      name: product.name,
      price: product.price,
      quantity: item.quantity,
      owner: product.createdBy
    });

    totalPrice += product.price * item.quantity;
  }

  const order = new Order({
    userId,
    products: orderProducts,
    total: totalPrice,
    shippingAddress
  });

  await order.save();

  res.status(201).send(order);
});


router.put('/editproduct/:id', authorizeRoles('admin', 'seller'), async (req, res) => {
  const product = await Product.findById(req.params.id);
  if (!product) return res.status(404).send('Product not found');

  if (req.session.role === 'seller' && String(product.createdBy) !== req.session.userId) {
    return res.status(403).send('Unauthorized');
  }

  Object.assign(product, req.body);
  await product.save();
  res.send('Product updated');
});

router.post('/cart/update/:productId', async (req, res) => {
  const { productId } = req.params;
  const { quantity } = req.body;

  const parsedQty = parseInt(quantity);

  if (parsedQty === 0) {
    await Cart.deleteOne({ userId: req.session.userId, 'items.productId': productId });
  } else {
    const cart = await Cart.findOne({ userId: req.session.userId });
    if (!cart) {
      
      const newCart = new Cart({
        userId: req.session.userId,
        items: [{ productId, quantity: parsedQty }]
      });
      await newCart.save();
    } else {
     
      const itemIndex = cart.items.findIndex(item => item.productId.toString() === productId);
      if (itemIndex > -1) {
        cart.items[itemIndex].quantity = parsedQty;
      } else {
        cart.items.push({ productId, quantity: parsedQty });
      }
      await cart.save();
    }
  }
  res.redirect('/cart');
});

router.post('/cart/remove/:productId', isAuthenticated, async (req, res) => {
  const userId = req.session.userId;
  const productId = req.params.productId;

  try {
    const cart = await Cart.findOne({ userId });

    if (!cart) {
      return res.redirect('/cart'); 
    }

    
    cart.items = cart.items.filter(item => item.productId.toString() !== productId);
    await cart.save();

    res.redirect('/cart');
  } catch (error) {
    console.error('Error removing item from cart:', error);
    res.status(500).send('Internal Server Error');
  }
});


router.post('/add-to-cart/:productId', async (req, res) => {
  const userId = req.session.userId;

  
  if (!userId) {
    return res.redirect('/?message=' + encodeURIComponent('Please login to add items to your cart.'));
  }
  const { productId } = req.params;
  const quantity = parseInt(req.body.quantity) || 1;

  let cart = await Cart.findOne({ userId });
  if (!cart) {
    cart = new Cart({ userId, items: [] });  
  }

  const itemIndex = cart.items.findIndex(item => item.productId.toString() === productId);
  if (itemIndex > -1) {
    cart.items[itemIndex].quantity += quantity;
  } else {
    cart.items.push({ productId, quantity });
  }

  await cart.save();
  res.redirect('/cart');
});







router.get('/cart', isAuthenticated, async (req, res) => {
  const userId = req.session.userId;
if (!req.session.userId) {
  return res.status(401).send('Login required to add to cart.');
}

  try {
    const cart = await Cart.findOne({ userId }).populate('items.productId');
    if (!cart) {
      // No cart found, render empty cart page instead of sending 404
      return res.render('cart', { items: [], totalPrice: 0, userId });
    }

    const cartItems = cart.items
      .map(item => {
        if (!item.productId) return null;
        return {
          product: item.productId,
          quantity: item.quantity,
          totalPrice: item.productId.price * item.quantity,
        };
      })
      .filter(item => item !== null);

    const totalPrice = cartItems.reduce((sum, item) => sum + item.totalPrice, 0);

   
    res.render('cart', { items: cartItems, totalPrice, userId });
  } catch (err) {
    console.error('Error fetching cart:', err);
    res.status(500).send('Internal Server Error');
  }
});



router.post('/checkout', async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).send('Login required to checkout.');
  }

  try {
    const { street, city, state, zip, country } = req.body;
    const shippingAddress = { street, city, state, zip, country };

    const cart = await Cart.findOne({ userId: req.session.userId }).populate({
      path: 'items.productId',
      populate: { path: 'createdBy', model: 'User' }
    });

    if (!cart || cart.items.length === 0) {
      return res.status(400).send('Cart is empty.');
    }

    const validItems = cart.items.filter(item => item.productId);
    if (validItems.length !== cart.items.length) {
      cart.items = validItems;
      await cart.save();
    }

    const orderProducts = validItems.map(item => {
      if (!item.productId.createdBy) {
        throw new Error('createdBy missing for product: ' + item.productId.name);
      }

      return {
        product: item.productId._id,
        name: item.productId.name,
        price: item.productId.price,
        quantity: item.quantity,
        createdBy: item.productId.createdBy._id
      };
    });

    const total = orderProducts.reduce((acc, item) => acc + item.price * item.quantity, 0);

    const order = new Order({
      userId: req.session.userId,
      products: orderProducts,
      total,
      shippingAddress
    });

    await order.save();
    await Cart.deleteOne({ userId: req.session.userId });

    // Save orderId in session if needed
    req.session.lastOrderId = order._id;

    res.send(`
  <h2>Order placed</h2>
  <a href="/" style="
    display: inline-block;
    padding: 10px;
    background-color: #28a745; 
    color: white;
    text-decoration: none;
    border-radius: 7px;
    font-weight: bold;
   font-family: 'Times New Roman', Times, serif;
  ">
    Shop more
  </a>
  <a href="/user-orders" style="
    display: inline-block;
    padding: 10px;
    background-color: #28a745; 
    color: white;
    text-decoration: none;
    border-radius: 7px;
    font-weight: bold;
  font-family: 'Times New Roman', Times, serif;
  ">
    View Orders
  </a>
`);

  } catch (err) {
    console.error('Checkout failed:', err.message);
    console.error('Full error:', err);
    res.status(500).send('Checkout failed. Please try again.');
  }
});

router.get('/admin/orders', isAdmin, async (req, res) => {
  try {
    const orders = await Order.find()
      .populate('userId', 'username') 
      .populate('products.product'); 

    res.render('admin-orders', { orders }); 
  } catch (error) {
    console.error('Error fetching admin orders:', error);
    res.status(500).send('Failed to fetch orders');
  }
});



router.get('/seller/orders', isSeller, async (req, res) => {
  try {
    const sellerId = req.session.userId;
    const statusFilter = req.query.status || '';

    const sellerProducts = await Product.find({ createdBy: sellerId });
    const sellerProductIds = sellerProducts.map(p => p._id.toString());

    const orders = await Order.find().populate('userId');

    const filteredOrders = orders.map(order => {
      const relevantProducts = order.products.filter(p => sellerProductIds.includes(p.product.toString()));
      if (relevantProducts.length === 0) return null;

      const filteredOrder = {
        ...order.toObject(),
        products: relevantProducts
      };

  
      if (statusFilter && filteredOrder.status !== statusFilter) {
        return null;
      }

      return filteredOrder;
    }).filter(order => order !== null);

    res.render('seller-orders', { 
      orders: filteredOrders,
      statusFilter 
    });

  } catch (error) {
    console.error('Error fetching seller orders:', error);
    res.status(500).send('Failed to fetch seller orders');
  }
});
router.post("/admin/orders/:orderId/status", async (req, res) => {
  const { orderId } = req.params;
  const { status } = req.body;

  try {
    await Order.findByIdAndUpdate(orderId, { status });
    res.redirect("/admin/orders");
  } catch (err) {
    console.error("Error updating order status:", err);
    res.status(500).send("Internal Server Error");
  }
});

router.post("/seller/orders/:orderId/status", async (req, res) => {
  const { orderId } = req.params;
  const { status } = req.body;

  try {
    await Order.findByIdAndUpdate(orderId, { status });
    res.redirect("/seller/orders"); 
  } catch (err) {
    console.error("Error updating order status:", err);
    res.status(500).send("Internal Server Error");
  }
});
router.get('/user-orders', async (req, res) => {
  try {
    const userId = req.session.userId;
    if (!userId) {
      return res.status(401).send('Unauthorized');
    }

    const orders = await Order.find({ userId })
      .populate('products.product');

    res.render('user-orders', { orders });
  } catch (err) {
    console.error('Error fetching user orders:', err);
    res.status(500).send('Internal Server Error');
  }
});



router.get('/admin/products', isAdmin, async (req, res) => {
  const products = await Product.find();
  res.json(products);
});

router.get('/seller/products', isSeller, async (req, res) => {
  const products = await Product.find({ createdBy: req.session.userId });
  res.json(products);
});

router.delete('/deleteproduct/:id', authorizeRoles('admin', 'seller'), async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).send('Product not found');

    if (req.session.role === 'seller' && String(product.createdBy) !== req.session.userId) {
      return res.status(403).send('Unauthorized');
    }

    await Product.findByIdAndDelete(req.params.id);
    res.send('Product deleted successfully');
  } catch (err) {
    console.error('Delete product error:', err);
    res.status(500).send('Failed to delete product');
  }
});



router.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).send('Could not log out. Please try again.');
    }
    res.redirect('/');
  });
});


router.get('/admin/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error('Admin logout error:', err);
      return res.status(500).send('Could not log out admin.');
    }
    res.redirect('/');
  });
});


export default router;

