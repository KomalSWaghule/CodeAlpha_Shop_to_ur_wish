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
if (!userId) return res.redirect('/login'); // or send 401

  
  res.send(`Your user ID is ${userId}`);
});


// Configure storage for multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, './uploads/'); // folder where images are saved (make sure this folder exists)
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname); // unique filename
  }
});

const upload = multer({ storage: storage });


// Role-based middleware
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

// Constants for admin credentials
const ADMIN_USERNAME = 'admin123@gmail.com';
const ADMIN_PASSWORD = '12345';

// ecommerceRoutes.js or your index route file
router.get('/', async (req, res) => {
  const products = await Product.find();
  const userId = req.session.userId || null;
  const role = req.session.role || null;

  let userOrders = [];
  if (userId) {
    userOrders = await Order.find({ userId })
      .populate('products.product', 'name price') // populate product details
      .sort({ createdAt: -1 });
  }

  res.render('index', {
    products,
    userId,
    role,
    user: req.session.user,
    userOrders
  });
});

 



// Show registration form
router.get('/register', (req, res) => {
  res.render('register'); // Ensure views/register.ejs exists
});
// User registration
router.post('/register', async (req, res) => {
  try {
    const { username, password, role } = req.body;

    let userRole = role || 'user';
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      userRole = 'admin';
    }

    const user = new User({
      username: username.trim(),
      password,  // will be hashed by pre-save hook
      role: userRole
    });

    await user.save();

    // Auto login after register
    req.session.userId = user._id.toString();
    req.session.role = user.role;

    res.redirect('/');  // or dashboard page

  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).render('register', { error: 'Failed to register user. Try again.' });
  }
});
// Middleware to load user from session and attach to req.user
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



// Show login form
router.get('/login', (req, res) => {
  res.render('login'); // Ensure views/login.ejs exists
});

// User login
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

    // Save session data
    req.session.userId = user._id.toString();
    req.session.role = user.role;

    // Redirect to home page or dashboard
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
  user.password = newPassword; // plain password
  await user.save(); // triggers pre save hook to hash password
  console.log('Password rehashed successfully');
}

rehashPassword('komalwaghule05@gmail.com', '1106');

// Show reset password form
router.get('/reset-password', (req, res) => {
  res.render('reset-password');  // Create views/reset-password.ejs
});

// Handle reset password submission
router.post('/reset-password', async (req, res) => {
  const { username, newPassword } = req.body;

  try {
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).send('User not found');
    }

    user.password = newPassword; // this triggers the pre-save hook to hash it
    await user.save();

    res.send('Password reset successful. You can now log in with your new password.');
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).send('Server error');
  }
});

// Admin & Seller: Add product
// Only admin and seller can access add product form
router.get('/addproduct', authorizeRoles('admin', 'seller'), (req, res) => {
  res.render('addproduct'); // Create views/addproduct.ejs
});

// POST route to add a product
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
      name,
      price,
      description,
      image: imagePath,
      createdBy,
      category: formattedCategory
    });

    const savedProduct = await newProduct.save();

    res.redirect(`/product/${savedProduct._id}`);

  } catch (error) {
    console.error('Error adding product:', error);
    res.status(500).send('Product creation failed');
  }
});

// GET route to list all products
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
// GET /products?type=Electronics
// GET /products?type=Electronics
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
  res.redirect('/product/' + productId); // or however you view the product
});

router.get('/some-route', async (req, res) => {
  const userId = req.session.userId;  // <-- get userId from session

  const orders = await Order.find({
    'products.owner': userId
  }).populate('product.product');

  // use orders ...
});

router.post('/createOrder', async (req, res) => {
  const { products, userId, shippingAddress } = req.body; // products = [{ productId, quantity }]
  
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


// Admin & Seller: Edit product
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
// User: Update quantity in cart
router.post('/cart/update/:productId', async (req, res) => {
  const { productId } = req.params;
  const { quantity } = req.body;

  const parsedQty = parseInt(quantity);

  if (parsedQty === 0) {
    await Cart.deleteOne({ userId: req.session.userId, 'items.productId': productId });
  } else {
    const cart = await Cart.findOne({ userId: req.session.userId });
    if (!cart) {
      // If no cart exists, create one with the product and quantity
      const newCart = new Cart({
        userId: req.session.userId,
        items: [{ productId, quantity: parsedQty }]
      });
      await newCart.save();
    } else {
      // Update existing item quantity or add new item
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

// Remove product from cart
router.post('/cart/remove/:productId', isAuthenticated, async (req, res) => {
  const userId = req.session.userId;
  const productId = req.params.productId;

  try {
    const cart = await Cart.findOne({ userId });

    if (!cart) {
      return res.redirect('/cart'); // Redirect if cart not found
    }

    // Filter out the item
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

// User: Add to cart
// User: Add to cart (POST /cart/add)



// User: View cart




router.get('/cart', isAuthenticated, async (req, res) => {
  const userId = req.session.userId;

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

    // Calculate total price for the whole cart
    const totalPrice = cartItems.reduce((sum, item) => sum + item.totalPrice, 0);

    // Pass both items and totalPrice to the template
    res.render('cart', { items: cartItems, totalPrice, userId });
  } catch (err) {
    console.error('Error fetching cart:', err);
    res.status(500).send('Internal Server Error');
  }
});



// User: Checkout
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
    padding: 10px 20px;
    background-color: #28a745; 
    color: white;
    text-decoration: none;
    border-radius: 5px;
    font-weight: bold;
    font-family: Arial, sans-serif;
  ">
    Shop more
  </a>
  <a href="/user-orders" style="
    display: inline-block;
    padding: 10px 20px;
    background-color: #28a745; 
    color: white;
    text-decoration: none;
    border-radius: 5px;
    font-weight: bold;
    font-family: Arial, sans-serif;
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



// Admin: View all orders
// Admin: View all orders
router.get('/admin/orders', isAdmin, async (req, res) => {
  try {
    const orders = await Order.find()
      .populate('userId', 'username') // populate user info
      .populate('products.product');  // populate product details

    res.render('admin-orders', { orders }); // Create views/admin-orders.ejs
  } catch (error) {
    console.error('Error fetching admin orders:', error);
    res.status(500).send('Failed to fetch orders');
  }
});


// Seller: View orders for their products only
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

      // ✅ Filter by status if specified
      if (statusFilter && filteredOrder.status !== statusFilter) {
        return null;
      }

      return filteredOrder;
    }).filter(order => order !== null);

    res.render('seller-orders', { 
      orders: filteredOrders,
      statusFilter // ✅ This fixes the ReferenceError
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
    res.redirect("/admin/orders"); // Redirect back to the orders page
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
    res.redirect("/seller/orders"); // Redirect back to the orders page
  } catch (err) {
    console.error("Error updating order status:", err);
    res.status(500).send("Internal Server Error");
  }

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



// Admin: View all products
router.get('/admin/products', isAdmin, async (req, res) => {
  const products = await Product.find();
  res.json(products);
});

// Seller: View own products
router.get('/seller/products', isSeller, async (req, res) => {
  const products = await Product.find({ createdBy: req.session.userId });
  res.json(products);
});
// Admin & Seller: Delete product
// Admin & Seller: Delete product
router.delete('/deleteproduct/:id', authorizeRoles('admin', 'seller'), async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).send('Product not found');

    // If seller, ensure they can only delete their own products
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


// =======================
// Logout for all users
// =======================
router.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).send('Could not log out. Please try again.');
    }
    res.redirect('/');
  });
});

// =======================
// Admin Logout (optional if different)
// =======================
router.get('/admin/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      console.error('Admin logout error:', err);
      return res.status(500).send('Could not log out admin.');
    }
    res.redirect('/');
  });
});

// Export router
export default router;

