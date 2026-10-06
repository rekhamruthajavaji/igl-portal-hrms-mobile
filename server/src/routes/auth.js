import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db, { logAudit } from '../db.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  const user = db.prepare('SELECT * FROM users WHERE email = ? AND is_active = 1').get(email.toLowerCase());
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  if (!bcrypt.compareSync(password, user.password_hash)) return res.status(401).json({ error: 'Invalid credentials' });
  const employee = db.prepare('SELECT * FROM employees WHERE user_id = ?').get(user.id);
  const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
  logAudit(user.id, 'login', 'user', user.id);
  res.json({
    token,
    user: { id: user.id, email: user.email, role: user.role, employee }
  });
});

router.get('/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

// Self-service: a logged-in user sets their own new password (no ticket needed).
router.post('/set-password', authenticate, (req, res) => {
  const { newPassword } = req.body || {};
  if (!newPassword || String(newPassword).trim().length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  const hash = bcrypt.hashSync(String(newPassword).trim(), 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, req.user.id);
  logAudit(req.user.id, 'set_password', 'user', req.user.id);
  res.json({ ok: true });
});

// Forgot password (public) — only works for an email that belongs to a real, active account.
router.post('/forgot-password', (req, res) => {
  const { email, newPassword } = req.body || {};
  if (!email || !newPassword) return res.status(400).json({ error: 'Email and new password are required' });
  if (String(newPassword).trim().length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  const user = db.prepare('SELECT id FROM users WHERE email = ? AND is_active = 1').get(String(email).toLowerCase().trim());
  if (!user) return res.status(404).json({ error: 'No account found with that email address' });
  const hash = bcrypt.hashSync(String(newPassword).trim(), 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, user.id);
  logAudit(user.id, 'forgot_password_reset', 'user', user.id);
  res.json({ ok: true });
});

router.post('/change-password', authenticate, (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Both passwords required' });
  if (newPassword.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(currentPassword, u.password_hash)) return res.status(401).json({ error: 'Current password incorrect' });
  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, req.user.id);
  logAudit(req.user.id, 'change_password', 'user', req.user.id);
  res.json({ ok: true });
});

export default router;
