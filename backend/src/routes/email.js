const express = require('express');
const nodemailer = require('nodemailer');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

/**
 * POST /api/email/test - Send a test email to ADMIN_EMAIL (admin only).
 */
router.post('/test', requireRole('admin'), async (req, res) => {
  const adminEmail = process.env.ADMIN_EMAIL;
  if (!adminEmail) {
    return res.status(400).json({ message: 'ADMIN_EMAIL not set in .env' });
  }
  const user = process.env.EMAIL_USER;
  const pass = process.env.EMAIL_PASS;
  if (!user || !pass) {
    return res.status(400).json({ message: 'EMAIL_USER / EMAIL_PASS not set in .env' });
  }
  try {
    const transport = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: { user, pass }
    });
    await transport.sendMail({
      from: process.env.EMAIL_FROM || 'Northblomst <no-reply@northblomst.dk>',
      to: adminEmail,
      subject: 'Northblomst – e-mail test',
      html: '<p>E-mail er konfigureret korrekt.</p>'
    });
    res.json({ sent: true });
  } catch (err) {
    console.error('Test email failed', err);
    res.status(500).json({ sent: false, error: err.message });
  }
});

module.exports = router;
