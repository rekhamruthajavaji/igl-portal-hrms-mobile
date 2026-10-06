import { Router } from 'express';
import db, { logAudit } from '../db.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

router.get('/departments', (_req, res) => {
  const rows = db.prepare(`
    SELECT d.*, (SELECT COUNT(*) FROM employees WHERE department_id = d.id) as employee_count
    FROM departments d ORDER BY d.name
  `).all();
  res.json(rows);
});

router.post('/departments', authorize('admin'), (req, res) => {
  const { name, description } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Name required' });
  const id = db.prepare('INSERT INTO departments (name, description) VALUES (?,?)').run(name, description || null).lastInsertRowid;
  logAudit(req.user.id, 'create', 'department', id);
  res.status(201).json({ id });
});

router.put('/departments/:id', authorize('admin'), (req, res) => {
  const { name, description } = req.body || {};
  db.prepare('UPDATE departments SET name = COALESCE(?, name), description = COALESCE(?, description) WHERE id = ?').run(name, description, req.params.id);
  res.json({ ok: true });
});

router.delete('/departments/:id', authorize('admin'), (req, res) => {
  db.prepare('DELETE FROM departments WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

router.get('/teams', (_req, res) => {
  const rows = db.prepare(`
    SELECT t.*, d.name as department_name,
      m.first_name || ' ' || m.last_name as manager_name,
      (SELECT COUNT(*) FROM employees WHERE team_id = t.id) as member_count
    FROM teams t
    LEFT JOIN departments d ON d.id = t.department_id
    LEFT JOIN employees m ON m.id = t.manager_id
    ORDER BY t.name
  `).all();
  res.json(rows);
});

router.post('/teams', authorize('admin'), (req, res) => {
  const { name, department_id, manager_id } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Name required' });
  const id = db.prepare('INSERT INTO teams (name, department_id, manager_id) VALUES (?,?,?)').run(name, department_id || null, manager_id || null).lastInsertRowid;
  logAudit(req.user.id, 'create', 'team', id);
  res.status(201).json({ id });
});

router.put('/teams/:id', authorize('admin'), (req, res) => {
  const { name, department_id, manager_id } = req.body || {};
  db.prepare('UPDATE teams SET name = COALESCE(?, name), department_id = COALESCE(?, department_id), manager_id = COALESCE(?, manager_id) WHERE id = ?').run(name, department_id, manager_id, req.params.id);
  res.json({ ok: true });
});

router.delete('/teams/:id', authorize('admin'), (req, res) => {
  db.prepare('DELETE FROM teams WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
