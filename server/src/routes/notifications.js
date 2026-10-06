import { Router } from 'express';
import db from '../db.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 100').all(req.user.id);
  res.json(rows);
});

router.get('/unread-count', (req, res) => {
  const r = db.prepare('SELECT COUNT(*) as c FROM notifications WHERE user_id = ? AND is_read = 0').get(req.user.id);
  res.json({ count: r.c });
});

router.post('/:id/read', (req, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ ok: true });
});

router.post('/read-all', (req, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.user.id);
  res.json({ ok: true });
});

router.post('/broadcast', authorize('admin'), (req, res) => {
  const { title, message, type, link } = req.body || {};
  if (!title) return res.status(400).json({ error: 'Title required' });
  const users = db.prepare('SELECT id FROM users WHERE is_active = 1').all();
  const stmt = db.prepare('INSERT INTO notifications (user_id, title, message, type, link) VALUES (?,?,?,?,?)');
  users.forEach(u => stmt.run(u.id, title, message || null, type || 'announcement', link || null));
  res.json({ ok: true, sent: users.length });
});

export default router;
