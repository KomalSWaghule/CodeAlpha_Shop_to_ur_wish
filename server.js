import express from 'express';
import mongoose from 'mongoose';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import passport from 'passport';
import bodyParser from 'body-parser';
import path from 'path';
import dotenv from 'dotenv';

import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Load environment variables
dotenv.config();

// For __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();

// Environment variables
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;
const SESSION_SECRET = process.env.SESSION_SECRET || "mySecretKey";

// Middleware
app.use(bodyParser.json());

app.use(express.static(path.join(__dirname, 'public')));

app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// MongoDB Connection
mongoose.connect(MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Session Middleware
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,

  store: MongoStore.create({
    mongoUrl: MONGODB_URI
  }),

  cookie: {
    maxAge: 1000 * 60 * 60 * 24 // 1 day
  }
}));

// Passport Middleware
app.use(passport.initialize());
app.use(passport.session());

// Routes
import mainRoutes from './Routes/index.js';

app.use('/', mainRoutes);

// Start Server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});