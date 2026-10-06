import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db, { logAudit, createNotification } from '../db.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);
router.use(authorize('admin')); // HR/admin only — password management is sensitive.

// Everything the Password Management screen needs in one call.
router.get('/overview', (_req, res) => {
  const requests = db.prepare(`
    SELECT t.id AS ticket_id, t.subject, t.message, t.created_at, t.user_id,
           u.email, u.role, e.first_name, e.last_name, e.employee_code
    FROM tickets t
    JOIN users u ON u.id = t.user_id
    LEFT JOIN employees e ON e.id = t.employee_id
    WHERE t.category = 'password' AND t.status = 'open'
    ORDER BY t.created_at DESC
  `).all();

  const users = db.prepare(`
    SELECT u.id AS user_id, u.email, u.role, u.is_active,
           e.first_name, e.last_name, e.employee_code, e.designation
    FROM users u
    LEFT JOIN employees e ON e.user_id = u.id
    WHERE u.role != 'admin'
    ORDER BY e.first_name, u.email
  `).all();

  res.json({ requests, users });
});

// Badge count for the sidebar/topbar icon.
router.get('/request-count', (_req, res) => {
  const r = db.prepare("SELECT COUNT(*) AS c FROM tickets WHERE category = 'password' AND status = 'open'").get();
  res.json({ count: r.c });
});

// Reset a user's password. Optionally resolves the linked password ticket.
router.post('/reset', (req, res) => {
  const { userId, newPassword, ticketId } = req.body || {};
  if (!userId || !newPassword) return res.status(400).json({ error: 'User and new password are required' });
  if (String(newPassword).trim().length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!target) return res.status(404).json({ error: 'User not found' });
  if (target.role === 'admin') return res.status(403).json({ error: 'Admin passwords cannot be reset here' });

  const hash = bcrypt.hashSync(String(newPassword).trim(), 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, userId);

  // If this came from a ticket, close the loop on it too.
  let resolvedTicket = false;
  if (ticketId) {
    const tk = db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId);
    if (tk && tk.user_id === Number(userId) && tk.status === 'open') {
      db.prepare(
        "UPDATE tickets SET admin_reply = ?, status = 'resolved', resolved_by = ?, resolved_at = CURRENT_TIMESTAMP WHERE id = ?"
      ).run('Your password has been reset by HR. Please sign in with the new password.', req.user.id, tk.id);
      resolvedTicket = true;
    }
  }

  createNotification(
    userId,
    'Your password has been reset',
    'An administrator has reset your password. You can now sign in with the new password provided to you.',
    'security',
    null
  );
  logAudit(req.user.id, 'reset_password', 'user', userId, { ticketId: ticketId || null });

  res.json({ ok: true, resolvedTicket });
});

export default router;
