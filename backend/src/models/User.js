const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, index: true },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: ['admin', 'partner'],
      default: 'partner'
    },
    phone: String,
    address: String,
    cvr: String,
    bankAccount: String,
    bankName: String,
    zoneRanges: [String],
    /** When true, partner gets fixed 69 DKK delivery in payout. When false (e.g. terminal), Northblomst keeps delivery. */
    handlesDelivery: { type: Boolean, default: true },
    /** Suspended partners may only view their own reports — no order system access. */
    suspended: { type: Boolean, default: false }
  },
  {
    timestamps: true
  }
);

UserSchema.methods.comparePassword = function comparePassword(plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

UserSchema.statics.hashPassword = async function hashPassword(plain) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plain, salt);
};

module.exports = mongoose.model('User', UserSchema);

