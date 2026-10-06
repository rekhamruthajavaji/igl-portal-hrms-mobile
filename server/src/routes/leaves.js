import { Router } from 'express';
import db, { logAudit, createNotification } from '../db.js';
import { holidayStateFor } from '../data/holidays2026.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

function businessDays(start, end) {
  const s = new Date(start);
  const e = new Date(end);
  if (e < s) return 0;
  let count = 0;
  const cur = new Date(s);
  while (cur <= e) {
    const day = cur.getDay();
    if (day !== 0 && day !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

router.get('/types', (_req, res) => {
  res.json(db.prepare('SELECT * FROM leave_types ORDER BY name').all());
});

// Team leave calendar: approved leaves overlapping a month + that month's holidays.
router.get('/calendar', (req, res) => {
  const month = Number(req.query.month) || new Date().getMonth() + 1;
  const year = Number(req.query.year) || new Date().getFullYear();
  const mm = String(month).padStart(2, '0');
  const from = `${year}-${mm}-01`;
  const to = `${year}-${mm}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`;
  const leaves = db.prepare(`
    SELECT l.start_date, l.end_date, l.days, lt.name AS leave_type, lt.code,
           e.first_name || ' ' || e.last_name AS employee_name, e.employee_code, u.email
    FROM leaves l
    JOIN leave_types lt ON lt.id = l.leave_type_id
    JOIN employees e ON e.id = l.employee_id
    JOIN users u ON u.id = e.user_id
    WHERE l.status = 'approved' AND NOT (l.end_date < ? OR l.start_date > ?)
    ORDER BY l.start_date`).all(from, to);
  const holidays = db.prepare('SELECT name, date, state FROM holidays WHERE date BETWEEN ? AND ? AND state = ? ORDER BY date')
    .all(from, to, holidayStateFor(req.user.employee?.state));
  res.json({ leaves, holidays, from, to });
});

router.get('/balances', (req, res) => {
  const empId = req.query.employee_id || req.user.employee?.id;
  if (req.user.role === 'employee' && Number(empId) !== req.user.employee.id) return res.status(403).json({ error: 'Forbidden' });
  const year = Number(req.query.year) || new Date().getFullYear();
  const rows = db.prepare(`
    SELECT lb.*, lt.name as leave_type_name, lt.code as leave_type_code, lt.is_paid
    FROM leave_balances lb
    JOIN leave_types lt ON lt.id = lb.leave_type_id
    WHERE lb.employee_id = ? AND lb.year = ?
    ORDER BY lt.name
  `).all(empId, year);
  res.json(rows);
});

router.get('/', (req, res) => {
  let rows;
  const base = `
    SELECT l.*, lt.name as leave_type_name, lt.code as leave_type_code,
      e.first_name || ' ' || e.last_name as employee_name, e.employee_code,
      e.manager_id as employee_manager_id,
      a.first_name || ' ' || a.last_name as approver_name
    FROM leaves l
    JOIN leave_types lt ON lt.id = l.leave_type_id
    JOIN employees e ON e.id = l.employee_id
    LEFT JOIN employees a ON a.id = l.approver_id
  `;
  if (req.user.role === 'admin') {
    // HR sees their own leaves (all statuses) + others' leaves once a manager has decided,
    // + top-level leaves (no manager), + any pending leaves where HR is the direct manager.
    rows = db.prepare(`${base}
      WHERE l.employee_id = ?
         OR l.status != 'pending'
         OR e.manager_id IS NULL
         OR e.manager_id = ?
      ORDER BY l.applied_at DESC`).all(req.user.employee.id, req.user.employee.id);
  } else if (req.user.role === 'manager') {
    rows = db.prepare(`${base} WHERE e.manager_id = ? OR e.id = ? ORDER BY l.applied_at DESC`).all(req.user.employee.id, req.user.employee.id);
  } else {
    rows = db.prepare(`${base} WHERE l.employee_id = ? ORDER BY l.applied_at DESC`).all(req.user.employee.id);
  }
  res.json(rows);
});

router.post('/', (req, res) => {
  const { leave_type_id, start_date, end_date, reason } = req.body || {};
  if (!leave_type_id || !start_date || !end_date) return res.status(400).json({ error: 'leave_type_id, start_date, end_date required' });
  if (new Date(end_date) < new Date(start_date)) return res.status(400).json({ error: 'End date cannot be before start date' });
  const empId = req.user.employee.id;
  const days = businessDays(start_date, end_date);
  if (days === 0) return res.status(400).json({ error: 'Selected range has no working days. Saturdays and Sundays are non-working by default.' });
  const year = new Date(start_date).getFullYear();
  const bal = db.prepare('SELECT * FROM leave_balances WHERE employee_id = ? AND leave_type_id = ? AND year = ?').get(empId, leave_type_id, year);
  if (bal && (bal.total - bal.used) < days) {
    return res.status(400).json({ error: `Insufficient balance. Available: ${bal.total - bal.used} days` });
  }
  const id = db.prepare(`INSERT INTO leaves (employee_id, leave_type_id, start_date, end_date, days, reason, status)
    VALUES (?,?,?,?,?,?, 'pending')`).run(empId, leave_type_id, start_date, end_date, days, reason || null).lastInsertRowid;

  // Notify the direct approver only. If the employee has no manager (top-level), notify HR (admins).
  const empRow = db.prepare('SELECT manager_id FROM employees WHERE id = ?').get(empId);
  const applicantName = `${req.user.employee.first_name} ${req.user.employee.last_name}`;
  if (empRow.manager_id) {
    const mgr = db.prepare('SELECT user_id FROM employees WHERE id = ?').get(empRow.manager_id);
    if (mgr) createNotification(mgr.user_id, 'New leave request', `${applicantName} requested ${days} day(s) of leave`, 'leave', '/leaves');
  } else {
    const admins = db.prepare("SELECT id FROM users WHERE role = 'admin'").all();
    admins.forEach(a => createNotification(a.id, 'New leave request (top-level)', `${applicantName} requested ${days} day(s) of leave. No direct manager — HR approval required.`, 'leave', '/leaves'));
  }

  logAudit(req.user.id, 'apply', 'leave', id);
  res.status(201).json({ id, days });
});

// Returns { ok: true } if req.user is permitted to act on leave.employee_id, or { error } otherwise.
function checkApprover(reqUser, employeeId) {
  const emp = db.prepare('SELECT manager_id FROM employees WHERE id = ?').get(employeeId);
  if (emp.manager_id) {
    // The direct manager can always act — even if they also hold the admin role.
    if (reqUser.employee && reqUser.employee.id === emp.manager_id) return { ok: true };
    if (reqUser.role === 'admin') return { error: 'Only the direct manager can approve or reject this request.' };
    return { error: 'Not your team member' };
  }
  if (reqUser.role === 'admin') return { ok: true };
  return { error: 'This is a top-level request. Only HR can approve or reject.' };
}

router.post('/:id/approve', authorize('admin','manager'), (req, res) => {
  const leave = db.prepare('SELECT * FROM leaves WHERE id = ?').get(req.params.id);
  if (!leave) return res.status(404).json({ error: 'Not found' });
  if (leave.status !== 'pending') return res.status(400).json({ error: 'Already processed' });

  const check = checkApprover(req.user, leave.employee_id);
  if (!check.ok) return res.status(403).json({ error: check.error });

  const year = new Date(leave.start_date).getFullYear();
  db.prepare('UPDATE leaves SET status = ?, approver_id = ?, approved_at = CURRENT_TIMESTAMP, comments = ? WHERE id = ?')
    .run('approved', req.user.employee.id, req.body.comments || null, req.params.id);
  db.prepare('UPDATE leave_balances SET used = used + ? WHERE employee_id = ? AND leave_type_id = ? AND year = ?')
    .run(leave.days, leave.employee_id, leave.leave_type_id, year);

  const emp = db.prepare('SELECT user_id, first_name, last_name FROM employees WHERE id = ?').get(leave.employee_id);
  const approverName = `${req.user.employee.first_name} ${req.user.employee.last_name}`;
  const empName = `${emp.first_name} ${emp.last_name}`;

  // Notify the employee
  createNotification(emp.user_id, 'Leave approved', `Your leave from ${leave.start_date} to ${leave.end_date} has been approved by ${approverName}`, 'leave', '/leaves');

  // Notify HR — only when a manager (not HR themselves) approved
  if (req.user.role === 'manager') {
    const admins = db.prepare("SELECT id FROM users WHERE role = 'admin'").all();
    admins.forEach(a => createNotification(a.id, 'Leave approved',
      `${empName} is taking ${leave.days} day(s) leave (${leave.start_date} to ${leave.end_date}), approved by ${approverName}`,
      'leave', '/leaves'));
  }
  logAudit(req.user.id, 'approve', 'leave', leave.id);
  res.json({ ok: true });
});

router.post('/:id/reject', authorize('admin','manager'), (req, res) => {
  const leave = db.prepare('SELECT * FROM leaves WHERE id = ?').get(req.params.id);
  if (!leave) return res.status(404).json({ error: 'Not found' });
  if (leave.status !== 'pending') return res.status(400).json({ error: 'Already processed' });

  const check = checkApprover(req.user, leave.employee_id);
  if (!check.ok) return res.status(403).json({ error: check.error });

  db.prepare('UPDATE leaves SET status = ?, approver_id = ?, approved_at = CURRENT_TIMESTAMP, comments = ? WHERE id = ?')
    .run('rejected', req.user.employee.id, req.body.comments || null, req.params.id);

  const emp = db.prepare('SELECT user_id, first_name, last_name FROM employees WHERE id = ?').get(leave.employee_id);
  const approverName = `${req.user.employee.first_name} ${req.user.employee.last_name}`;
  const empName = `${emp.first_name} ${emp.last_name}`;

  createNotification(emp.user_id, 'Leave rejected', `Your leave from ${leave.start_date} to ${leave.end_date} was rejected by ${approverName}`, 'leave', '/leaves');

  if (req.user.role === 'manager') {
    const admins = db.prepare("SELECT id FROM users WHERE role = 'admin'").all();
    admins.forEach(a => createNotification(a.id, 'Leave rejected',
      `${empName}'s leave (${leave.start_date} to ${leave.end_date}) was rejected by ${approverName}`,
      'leave', '/leaves'));
  }
  logAudit(req.user.id, 'reject', 'leave', leave.id);
  res.json({ ok: true });
});

router.post('/:id/cancel', (req, res) => {
  const leave = db.prepare('SELECT * FROM leaves WHERE id = ?').get(req.params.id);
  if (!leave) return res.status(404).json({ error: 'Not found' });
  if (req.user.role === 'employee' && leave.employee_id !== req.user.employee.id) return res.status(403).json({ error: 'Forbidden' });
  if (leave.status === 'approved') {
    const year = new Date(leave.start_date).getFullYear();
    db.prepare('UPDATE leave_balances SET used = used - ? WHERE employee_id = ? AND leave_type_id = ? AND year = ?')
      .run(leave.days, leave.employee_id, leave.leave_type_id, year);
  }
  db.prepare("UPDATE leaves SET status = 'cancelled' WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

export default router;
