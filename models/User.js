
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userstructure = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['user', 'seller', 'admin'], default: 'user' }
});

userstructure.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  try {
    this.password = await bcrypt.hash(this.password, 10);
    next();
  } catch (err) {
    next(err);
  }
});

userstructure.methods.comparePassword = async function (userpassword) {
  return bcrypt.compare(userpassword, this.password);
};

const User = mongoose.model('User', userstructure);

export default User;
