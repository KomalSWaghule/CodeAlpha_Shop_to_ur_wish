import mongoose from 'mongoose';
import Product from './models/product.js';
import User from './models/user.js';

mongoose.connect('mongodb://localhost:27017/ecommerce')
  .then(() => console.log('MongoDB Connected'))
  .catch(err => console.error(err));

async function seedDB() {
  let user = await User.findOne({ username: 'admin123@gmail.com' });
  if (!user) {
    user = await User.create({
      username: 'admin123@gmail.com',
      password: '12345',
      role: 'admin'
    });
  }

  const products = [
    {
      name: 'Wireless Headphones',
      description: 'High quality wireless headphones with noise cancellation.',
      price: 1999,
      image: 'https://th.bing.com/th/id/R.1341ea15bdd051f95c556dad81144e53?rik=L6P9hbw93jno7w&riu=http%3a%2f%2fwww.bhphotovideo.com%2fimages%2fimages2500x2500%2fbeats_by_dr_dre_900_00183_01_studio_wireless_over_ear_headphone_1037578.jpg&ehk=Gvcvd4F3e5KImn%2bDtTXuzfLaCL5syVO0QX596b8x35M%3d&risl=&pid=ImgRaw&r=0',
      category: 'Electronics',
      createdBy: user._id
    },
    {
      name: 'Smart Watch',
      description: 'Track your fitness and notifications.',
      price: 2499,
      image: 'https://m.media-amazon.com/images/I/61ftG19NACL._AC_SL1500_.jpg',
      category: 'Electronics',
      createdBy: user._id
    },
    {
      name: 'Gaming Mouse',
      description: 'High DPI RGB gaming mouse.',
      price: 999,
      image: 'https://gamerfuss.com/wp-content/uploads/2020/02/8292-19f3ed.jpeg',
      category: 'Electronics',
      createdBy: user._id
    },
    {
      name: 'Laptop Stand',
      description: 'Ergonomic laptop stand for better posture.',
      price: 799,
      image: 'https://ishopgh.com/wp-content/uploads/2023/05/eng_pl_Baseus-stand-adjustable-laptop-stand-silver-LUJS000012-93155_16.jpg',
      category: 'Electronics',
      createdBy: user._id
    },
    {
      name: 'Cotton T-Shirt',
      description: 'Comfortable cotton T-shirt for everyday wear.',
      price: 499,
      image: 'https://example.com/images/cotton-tshirt.jpg',
      category: 'Clothes',
      createdBy: user._id
    },
    {
      name: 'Classic Novel',
      description: 'A timeless classic novel for your collection.',
      price: 299,
      image: 'https://example.com/images/classic-novel.jpg',
      category: 'Books',
      createdBy: user._id
    }
  ];

  await Product.deleteMany({});
  await Product.insertMany(products);
  console.log('Database seeded!');
  mongoose.connection.close();
}

seedDB();
