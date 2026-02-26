const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

const isProd = process.env.NODE_ENV === 'production';
const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: isProd ? 'none' : 'lax',
  secure: isProd
};

router.post('/login', async (req, res) => {
  const { email, password, remember } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password required' });
  }

  const user = await User.findOne({ email });
  if (!user) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const ok = await user.comparePassword(password);
  if (!ok) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const maxAge = remember !== false ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
  const token = jwt.sign(
    {
      sub: user._id.toString(),
      role: user.role
    },
    process.env.JWT_SECRET || 'dev_secret',
    { expiresIn: remember !== false ? '7d' : '1d' }
  );

  res.cookie('nb_token', token, {
    ...COOKIE_OPTS,
    maxAge
  });

  res.json({
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      zoneRanges: user.zoneRanges
    }
  });
});

router.get('/me', authMiddleware, async (req, res) => {
  const user = await User.findById(req.user.id).select('-passwordHash');
  if (!user) return res.status(401).json({ message: 'User not found' });
  res.json({
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      zoneRanges: user.zoneRanges
    }
  });
});

router.post('/logout', (req, res) => {
  res.clearCookie('nb_token', { ...COOKIE_OPTS, path: '/' });
  res.json({ success: true });
});

module.exports = router;
