const express = require('express');
const User = require('../models/User');
const Order = require('../models/Order');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

// Admin: list partners
router.get('/', requireRole('admin'), async (req, res) => {
  const partners = await User.find({ role: 'partner' }).select('-passwordHash');
  res.json(partners);
});

// Admin: create partner
router.post('/', requireRole('admin'), async (req, res) => {
  const { name, email, password, phone, address, zoneRanges } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  const existing = await User.findOne({ email });
  if (existing) {
    return res.status(400).json({ message: 'Email already in use' });
  }

  const passwordHash = await User.hashPassword(password);
  const partner = await User.create({
    name,
    email,
    passwordHash,
    phone,
    address,
    zoneRanges: zoneRanges || [],
    role: 'partner'
  });

  res.status(201).json({
    id: partner._id,
    name: partner.name,
    email: partner.email,
    phone: partner.phone,
    address: partner.address,
    zoneRanges: partner.zoneRanges
  });
});

// Admin: update partner
router.put('/:id', requireRole('admin'), async (req, res) => {
  const { name, email, phone, address, zoneRanges, password } = req.body;
  const partner = await User.findById(req.params.id);
  if (!partner || partner.role !== 'partner') {
    return res.status(404).json({ message: 'Partner not found' });
  }

  if (name) partner.name = name;
  if (email) partner.email = email;
  if (phone) partner.phone = phone;
  if (address) partner.address = address;
  if (Array.isArray(zoneRanges)) partner.zoneRanges = zoneRanges;
  if (password) {
    partner.passwordHash = await User.hashPassword(password);
  }

  await partner.save();

  res.json({
    id: partner._id,
    name: partner.name,
    email: partner.email,
    phone: partner.phone,
    address: partner.address,
    zoneRanges: partner.zoneRanges
  });
});

// Admin: delete partner (unassign orders first)
router.delete('/:id', requireRole('admin'), async (req, res) => {
  const partner = await User.findById(req.params.id);
  if (!partner || partner.role !== 'partner') {
    return res.status(404).json({ message: 'Partner not found' });
  }
  await Order.updateMany({ partner: partner._id }, { $set: { partner: null } });
  await partner.deleteOne();
  res.json({ success: true });
});

module.exports = router;

