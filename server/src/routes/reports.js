import { Router } from 'express';
import db from '../db.js';
import { holidayStateFor } from '../data/holidays2026.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

router.get('/dashboard', (req, res) => {
  if (req.user.role === 'employee') {
    const empId = req.user.employee.id;
    const year = new Date().getFullYear();
    const balances = db.prepare(`
      SELECT lt.name, lb.total, lb.used FROM leave_balances lb
      JOIN leave_types lt ON lt.id = lb.leave_type_id
      WHERE lb.employee_id = ? AND lb.year = ?`).all(empId, year);
    const pending = db.prepare("SELECT COUNT(*) as c FROM leaves WHERE employee_id = ? AND status = 'pending'").get(empId);
    const upcomingHolidays = db.prepare(`SELECT * FROM holidays WHERE date >= date('now') AND state = ? ORDER BY date LIMIT 5`).all(holidayStateFor(req.user.employee?.state));
    const recentPayslips = db.prepare(`SELECT * FROM payroll WHERE employee_id = ? ORDER BY year DESC, month DESC LIMIT 3`).all(empId);
    return res.json({ balances, pending_leaves: pending.c, upcoming_holidays: upcomingHolidays, recent_payslips: recentPayslips });
  }
  const totalEmployees = db.prepare("SELECT COUNT(*) as c FROM employees WHERE employment_status = 'active'").get();
  const pendingLeaves = db.prepare("SELECT COUNT(*) as c FROM leaves WHERE status = 'pending'").get();
  const departments = db.prepare(`SELECT d.name, COUNT(e.id) as count FROM departments d
    LEFT JOIN employees e ON e.department_id = d.id GROUP BY d.id`).all();
  const today = new Date().toISOString().slice(0,10);
  const presentToday = db.prepare("SELECT COUNT(*) as c FROM attendance WHERE date = ? AND check_in IS NOT NULL").get(today);
  const onLeaveToday = db.prepare("SELECT COUNT(DISTINCT employee_id) as c FROM leaves WHERE status = 'approved' AND ? BETWEEN start_date AND end_date").get(today);
  const recentLeaves = db.prepare(`
    SELECT l.*, lt.name as leave_type_name, e.first_name || ' ' || e.last_name as employee_name
    FROM leaves l JOIN leave_types lt ON lt.id = l.leave_type_id
    JOIN employees e ON e.id = l.employee_id
    ORDER BY l.applied_at DESC LIMIT 5`).all();
  const upcomingHolidays = db.prepare(`SELECT * FROM holidays WHERE date >= date('now') AND state = ? ORDER BY date LIMIT 5`).all(holidayStateFor(req.user.employee?.state));
  res.json({
    total_employees: totalEmployees.c,
    pending_leaves: pendingLeaves.c,
    present_today: presentToday.c,
    on_leave_today: onLeaveToday.c,
    departments,
    recent_leaves: recentLeaves,
    upcoming_holidays: upcomingHolidays
  });
});

router.get('/attendance-summary', authorize('admin','manager'), (req, res) => {
  const month = Number(req.query.month) || new Date().getMonth() + 1;
  const year = Number(req.query.year) || new Date().getFullYear();
  const monthStr = String(month).padStart(2,'0');
  const from = `${year}-${monthStr}-01`;
  const to = `${year}-${monthStr}-31`;
  const rows = db.prepare(`
    SELECT e.id, e.employee_code, e.first_name || ' ' || e.last_name as name,
      COUNT(a.id) as days_present,
      COALESCE(SUM(a.working_hours), 0) as total_hours,
      ROUND(COALESCE(AVG(a.working_hours), 0), 2) as avg_hours
    FROM employees e
    LEFT JOIN attendance a ON a.employee_id = e.id AND a.date BETWEEN ? AND ?
    WHERE e.employment_status = 'active'
    GROUP BY e.id
    ORDER BY name`).all(from, to);
  res.json(rows);
});

router.get('/leave-summary', authorize('admin','manager'), (req, res) => {
  const year = Number(req.query.year) || new Date().getFullYear();
  const rows = db.prepare(`
    SELECT e.id, e.employee_code, e.first_name || ' ' || e.last_name as name, lt.name as leave_type,
      lb.total, lb.used, (lb.total - lb.used) as remaining
    FROM employees e
    JOIN leave_balances lb ON lb.employee_id = e.id
    JOIN leave_types lt ON lt.id = lb.leave_type_id
    WHERE lb.year = ? AND e.employment_status = 'active'
    ORDER BY e.first_name, lt.name`).all(year);
  res.json(rows);
});

router.get('/audit-logs', authorize('admin'), (req, res) => {
  const rows = db.prepare(`SELECT a.*, u.email FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id
    ORDER BY a.created_at DESC LIMIT 200`).all();
  res.json(rows);
});

export default router;
