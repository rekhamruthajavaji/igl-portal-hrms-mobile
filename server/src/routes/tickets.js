import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db, { logAudit, createNotification } from '../db.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

const CATEGORIES = ['password', 'access', 'payroll', 'leave', 'offboarding', 'other'];

// Join helper: pull the raiser's name + email so admins see who filed it.
const SELECT = `
  SELECT t.*, u.email AS user_email,
         e.first_name, e.last_name, e.employee_code
  FROM tickets t
  JOIN users u ON u.id = t.user_id
  LEFT JOIN employees e ON e.id = t.employee_id
`;

// List tickets: admins see everything, everyone else sees only their own.
router.get('/', (req, res) => {
  const rows = req.user.role === 'admin'
    ? db.prepare(`${SELECT} ORDER BY (t.status = 'open') DESC, t.created_at DESC`).all()
    : db.prepare(`${SELECT} WHERE t.user_id = ? ORDER BY t.created_at DESC`).all(req.user.id);
  res.json(rows);
});

// Count of open tickets — drives the admin badge in the topbar.
router.get('/open-count', authorize('admin'), (_req, res) => {
  const r = db.prepare("SELECT COUNT(*) AS c FROM tickets WHERE status = 'open'").get();
  res.json({ count: r.c });
});

// Raise a ticket — any signed-in user. Notifies every active admin.
router.post('/', (req, res) => {
  const { category, subject, message } = req.body || {};
  if (!subject || !subject.trim()) return res.status(400).json({ error: 'Subject is required' });
  const cat = CATEGORIES.includes(category) ? category : 'other';

  const info = db.prepare(
    'INSERT INTO tickets (user_id, employee_id, category, subject, message) VALUES (?,?,?,?,?)'
  ).run(req.user.id, req.user.employee?.id || null, cat, subject.trim(), (message || '').trim() || null);

  const who = req.user.employee
    ? `${req.user.employee.first_name} ${req.user.employee.last_name}`
    : req.user.email;
  const admins = db.prepare("SELECT id FROM users WHERE role = 'admin' AND is_active = 1").all();
  admins.forEach(a =>
    createNotification(a.id, 'New support ticket', `${who}: ${subject.trim()}`, 'ticket', '/tickets')
  );

  logAudit(req.user.id, 'create_ticket', 'ticket', info.lastInsertRowid, { category: cat });
  res.status(201).json({ id: info.lastInsertRowid });
});

// Admin replies and resolves. Optionally sets a new password (for reset requests).
router.post('/:id/reply', authorize('admin'), (req, res) => {
  const { reply, newPassword } = req.body || {};
  if (!reply || !reply.trim()) return res.status(400).json({ error: 'A reply is required' });

  const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(req.params.id);
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

  // If the admin chose to reset the password as part of resolving, apply it.
  let passwordReset = false;
  if (newPassword && newPassword.trim()) {
    if (newPassword.trim().length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });
    const hash = bcrypt.hashSync(newPassword.trim(), 10);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, ticket.user_id);
    passwordReset = true;
  }

  db.prepare(
    "UPDATE tickets SET admin_reply = ?, status = 'resolved', resolved_by = ?, resolved_at = CURRENT_TIMESTAMP WHERE id = ?"
  ).run(reply.trim(), req.user.id, ticket.id);

  const title = passwordReset ? 'Your password has been reset' : 'Your ticket was resolved';
  createNotification(ticket.user_id, title, reply.trim(), 'ticket', '/tickets');

  logAudit(req.user.id, 'resolve_ticket', 'ticket', ticket.id, { passwordReset });
  res.json({ ok: true, passwordReset });
});

export default router;
