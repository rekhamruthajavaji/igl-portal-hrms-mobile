import { Router } from 'express';
import db, { logAudit } from '../db.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

function todayDate() { return new Date().toISOString().slice(0,10); }
function nowTime() { return new Date().toISOString(); }

router.post('/check-in', (req, res) => {
  const empId = req.user.employee.id;
  const date = todayDate();
  const existing = db.prepare('SELECT * FROM attendance WHERE employee_id = ? AND date = ?').get(empId, date);
  if (existing && existing.check_in) return res.status(400).json({ error: 'Already checked in today' });
  if (existing) {
    db.prepare('UPDATE attendance SET check_in = ? WHERE id = ?').run(nowTime(), existing.id);
  } else {
    db.prepare('INSERT INTO attendance (employee_id, date, check_in, status) VALUES (?,?,?, ?)').run(empId, date, nowTime(), 'present');
  }
  logAudit(req.user.id, 'check_in', 'attendance');
  res.json({ ok: true, time: nowTime() });
});

router.post('/check-out', (req, res) => {
  const empId = req.user.employee.id;
  const date = todayDate();
  const att = db.prepare('SELECT * FROM attendance WHERE employee_id = ? AND date = ?').get(empId, date);
  if (!att || !att.check_in) return res.status(400).json({ error: 'Not checked in yet' });
  if (att.check_out) return res.status(400).json({ error: 'Already checked out' });
  const out = nowTime();
  const hours = Math.round(((new Date(out) - new Date(att.check_in)) / 36e5) * 100) / 100;
  db.prepare('UPDATE attendance SET check_out = ?, working_hours = ? WHERE id = ?').run(out, hours, att.id);
  logAudit(req.user.id, 'check_out', 'attendance');
  res.json({ ok: true, time: out, working_hours: hours });
});

router.get('/today', (req, res) => {
  const empId = req.query.employee_id || req.user.employee.id;
  if (req.user.role === 'employee' && Number(empId) !== req.user.employee.id) return res.status(403).json({ error: 'Forbidden' });
  const row = db.prepare('SELECT * FROM attendance WHERE employee_id = ? AND date = ?').get(empId, todayDate());
  res.json(row || null);
});

router.get('/', (req, res) => {
  const { from, to } = req.query;
  let empId = req.query.employee_id;
  if (req.user.role === 'employee') empId = req.user.employee.id;
  const fromD = from || `${new Date().toISOString().slice(0,7)}-01`;
  const toD = to || todayDate();
  let rows;
  if (empId) {
    rows = db.prepare(`SELECT a.*, e.first_name || ' ' || e.last_name as employee_name, e.employee_code
      FROM attendance a JOIN employees e ON e.id = a.employee_id
      WHERE a.employee_id = ? AND a.date BETWEEN ? AND ? ORDER BY a.date DESC`).all(empId, fromD, toD);
  } else if (req.user.role === 'manager') {
    rows = db.prepare(`SELECT a.*, e.first_name || ' ' || e.last_name as employee_name, e.employee_code
      FROM attendance a JOIN employees e ON e.id = a.employee_id
      WHERE (e.manager_id = ? OR e.id = ?) AND a.date BETWEEN ? AND ? ORDER BY a.date DESC, e.first_name`).all(req.user.employee.id, req.user.employee.id, fromD, toD);
  } else {
    rows = db.prepare(`SELECT a.*, e.first_name || ' ' || e.last_name as employee_name, e.employee_code
      FROM attendance a JOIN employees e ON e.id = a.employee_id
      WHERE a.date BETWEEN ? AND ? ORDER BY a.date DESC, e.first_name`).all(fromD, toD);
  }
  res.json(rows);
});

router.get('/summary', (req, res) => {
  const month = Number(req.query.month) || new Date().getMonth() + 1;
  const year = Number(req.query.year) || new Date().getFullYear();
  const empId = req.query.employee_id || (req.user.role === 'employee' ? req.user.employee.id : null);
  const monthStr = String(month).padStart(2, '0');
  const from = `${year}-${monthStr}-01`;
  const to = `${year}-${monthStr}-31`;
  if (empId) {
    const r = db.prepare(`SELECT COUNT(*) as days_present, COALESCE(SUM(working_hours),0) as total_hours
      FROM attendance WHERE employee_id = ? AND date BETWEEN ? AND ?`).get(empId, from, to);
    return res.json(r);
  }
  res.json({ days_present: 0, total_hours: 0 });
});

export default router;
