import { Router } from 'express';
import db, { logAudit, createNotification } from '../db.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

router.get('/', (req, res) => {
  const base = `
    SELECT f.*,
      e.first_name || ' ' || e.last_name as employee_name, e.employee_code,
      m.first_name || ' ' || m.last_name as manager_name
    FROM feedback f
    JOIN employees e ON e.id = f.employee_id
    LEFT JOIN employees m ON m.id = f.manager_id
  `;
  let rows;
  if (req.user.role === 'admin') {
    rows = db.prepare(`${base} ORDER BY f.created_at DESC`).all();
  } else if (req.user.role === 'manager') {
    rows = db.prepare(`${base} WHERE f.manager_id = ? OR f.employee_id = ? ORDER BY f.created_at DESC`).all(req.user.employee.id, req.user.employee.id);
  } else {
    rows = db.prepare(`${base} WHERE f.employee_id = ? ORDER BY f.created_at DESC`).all(req.user.employee.id);
  }
  res.json(rows);
});

router.post('/', authorize('admin','manager'), (req, res) => {
  const { employee_id, period, strengths, improvements, goals, rating } = req.body || {};
  if (!employee_id || !period) return res.status(400).json({ error: 'employee_id and period required' });
  if (req.user.role === 'manager') {
    const emp = db.prepare('SELECT manager_id FROM employees WHERE id = ?').get(employee_id);
    if (emp.manager_id !== req.user.employee.id) return res.status(403).json({ error: 'Not your team member' });
  }
  const id = db.prepare(`INSERT INTO feedback (employee_id, manager_id, period, strengths, improvements, goals, rating)
    VALUES (?,?,?,?,?,?,?)`).run(employee_id, req.user.employee.id, period, strengths || null, improvements || null, goals || null, rating || null).lastInsertRowid;
  const emp = db.prepare('SELECT user_id FROM employees WHERE id = ?').get(employee_id);
  createNotification(emp.user_id, 'New feedback received', `You have received performance feedback for ${period}`, 'feedback', '/feedback');
  logAudit(req.user.id, 'create', 'feedback', id);
  res.status(201).json({ id });
});

router.delete('/:id', authorize('admin','manager'), (req, res) => {
  const f = db.prepare('SELECT * FROM feedback WHERE id = ?').get(req.params.id);
  if (!f) return res.status(404).json({ error: 'Not found' });
  if (req.user.role === 'manager' && f.manager_id !== req.user.employee.id) return res.status(403).json({ error: 'Forbidden' });
  db.prepare('DELETE FROM feedback WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
