const express = require('express');
const User = require('../models/User');
const Order = require('../models/Order');
const { requireRole } = require('../middleware/auth');
const { rebalanceOpenOrdersByPostal } = require('../services/partnerAutoAssign');

const router = express.Router();

function partnerPublicJson(partner, extra = {}) {
  return {
    id: partner._id,
    _id: partner._id,
    name: partner.name,
    email: partner.email,
    phone: partner.phone,
    address: partner.address,
    cvr: partner.cvr || '',
    bankAccount: partner.bankAccount || '',
    bankName: partner.bankName || '',
    zoneRanges: partner.zoneRanges,
    handlesDelivery: partner.handlesDelivery !== false,
    ...extra
  };
}

// Admin: list partners
router.get('/', requireRole('admin'), async (req, res) => {
  const partners = await User.find({ role: 'partner' }).select('-passwordHash');
  res.json(partners);
});

// Admin: create partner
router.post('/', requireRole('admin'), async (req, res) => {
  const { name, email, password, phone, address, cvr, bankAccount, bankName, zoneRanges, handlesDelivery } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Missing required fields' });
  }
  if (!String(cvr || '').trim() || !String(bankAccount || '').trim()) {
    return res.status(400).json({ message: 'CVR and bank account are required' });
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
    cvr: String(cvr).trim(),
    bankAccount: String(bankAccount).trim(),
    bankName: String(bankName || '').trim(),
    zoneRanges: zoneRanges || [],
    handlesDelivery: handlesDelivery !== false && handlesDelivery !== 'false',
    role: 'partner'
  });

  const rebalance = await rebalanceOpenOrdersByPostal();

  res.status(201).json(partnerPublicJson(partner, { autoAssigned: rebalance }));
});

// Admin: update partner
router.put('/:id', requireRole('admin'), async (req, res) => {
  const { name, email, phone, address, cvr, bankAccount, bankName, zoneRanges, password, handlesDelivery } = req.body;
  const partner = await User.findById(req.params.id);
  if (!partner || partner.role !== 'partner') {
    return res.status(404).json({ message: 'Partner not found' });
  }

  if (name) partner.name = name;
  if (email) partner.email = email;
  if (phone !== undefined) partner.phone = phone;
  if (address !== undefined) partner.address = address;
  if (cvr !== undefined) partner.cvr = String(cvr || '').trim();
  if (bankAccount !== undefined) partner.bankAccount = String(bankAccount || '').trim();
  if (bankName !== undefined) partner.bankName = String(bankName || '').trim();
  if (Array.isArray(zoneRanges)) partner.zoneRanges = zoneRanges;
  if (handlesDelivery !== undefined) {
    partner.handlesDelivery = handlesDelivery !== false && handlesDelivery !== 'false';
  }
  if (password) {
    partner.passwordHash = await User.hashPassword(password);
  }

  if (!partner.cvr || !partner.bankAccount) {
    return res.status(400).json({ message: 'CVR and bank account are required' });
  }

  await partner.save();
  const rebalance = await rebalanceOpenOrdersByPostal();

  res.json(partnerPublicJson(partner, { autoAssigned: rebalance }));
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
