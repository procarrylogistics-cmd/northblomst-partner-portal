const jwt = require('jsonwebtoken');
const User = require('../models/User');

const PUBLIC_PATHS = ['/auth/shopify', '/api/shopify/test'];

async function authMiddleware(req, res, next) {
  const path = req.originalUrl || req.path || '';
  if (PUBLIC_PATHS.some((p) => path.startsWith(p))) return next();

  const authHeader = req.headers.authorization || '';
  const fromHeader = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const fromCookie = req.cookies?.nb_token || null;
  const token = fromHeader || fromCookie;

  if (!token) {
    return res.status(401).json({ message: 'Missing authorization token' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret');
    const user = await User.findById(payload.sub);
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }
    req.user = {
      id: user._id,
      role: user.role,
      email: user.email,
      name: user.name
    };
    next();
  } catch (err) {
    console.error('Auth error', err);
    return res.status(401).json({ message: 'Invalid token' });
  }
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    next();
  };
}

/** Allow any of the given roles (admin, partner, etc.) */
function requireRoleAny(roles) {
  const allowed = new Set(Array.isArray(roles) ? roles : [roles]);
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
    if (!allowed.has(req.user.role)) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    next();
  };
}

module.exports = {
  authMiddleware,
  requireRole,
  requireRoleAny
};

