import { Router } from 'express';
import db from '../db.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { REQUIRED_DOC_TYPES } from './documents.js';

const router = Router();
router.use(authenticate, authorize('manager'));

const FEEDBACK_OVERDUE_DAYS = 90;

router.get('/action-center', (req, res) => {
  const mgrId = req.user.employee.id;

  // 1. Pending leave requests from direct reports
  const pendingLeaves = db.prepare(`
    SELECT l.id, l.start_date, l.end_date, l.days, l.reason, l.applied_at,
      lt.name as leave_type_name,
      e.first_name || ' ' || e.last_name as employee_name,
      e.employee_code
    FROM leaves l
    JOIN leave_types lt ON lt.id = l.leave_type_id
    JOIN employees e ON e.id = l.employee_id
    WHERE e.manager_id = ? AND l.status = 'pending'
    ORDER BY l.applied_at DESC
  `).all(mgrId);

  // 2. Direct reports missing mandatory documents
  const mandatoryNames = REQUIRED_DOC_TYPES.filter(t => t.mandatory).map(t => t.name);
  const reports = db.prepare(`
    SELECT id, employee_code, first_name, last_name
    FROM employees
    WHERE manager_id = ? AND employment_status = 'active'
  `).all(mgrId);

  const missingDocs = reports
    .map(e => {
      const uploaded = db.prepare('SELECT DISTINCT type FROM documents WHERE employee_id = ?').all(e.id).map(d => d.type);
      const missing = mandatoryNames.filter(n => !uploaded.includes(n));
      return missing.length === 0 ? null : {
        employee_id: e.id,
        employee_code: e.employee_code,
        name: `${e.first_name} ${e.last_name}`,
        missing,
        missing_count: missing.length,
        total_mandatory: mandatoryNames.length,
      };
    })
    .filter(Boolean);

  // 3. Overdue feedback — no feedback in 90+ days, or never
  const cutoff = new Date(Date.now() - FEEDBACK_OVERDUE_DAYS * 86400000).toISOString();
  const overdueFeedback = reports
    .map(e => {
      const last = db.prepare('SELECT MAX(created_at) as last_feedback_at FROM feedback WHERE employee_id = ?').get(e.id);
      const lastDate = last?.last_feedback_at || null;
      if (lastDate && lastDate >= cutoff) return null;
      const daysSince = lastDate
        ? Math.floor((Date.now() - new Date(lastDate).getTime()) / 86400000)
        : null;
      return {
        employee_id: e.id,
        employee_code: e.employee_code,
        name: `${e.first_name} ${e.last_name}`,
        last_feedback_at: lastDate,
        days_since: daysSince,
      };
    })
    .filter(Boolean);

  res.json({
    pending_leaves: pendingLeaves,
    missing_documents: missingDocs,
    overdue_feedback: overdueFeedback,
    total: pendingLeaves.length + missingDocs.length + overdueFeedback.length,
    team_size: reports.length,
    feedback_overdue_days: FEEDBACK_OVERDUE_DAYS,
  });
});

router.get('/action-count', (req, res) => {
  const mgrId = req.user.employee.id;
  const mandatoryNames = REQUIRED_DOC_TYPES.filter(t => t.mandatory).map(t => t.name);
  const reports = db.prepare("SELECT id FROM employees WHERE manager_id = ? AND employment_status = 'active'").all(mgrId);

  const pending = db.prepare(`
    SELECT COUNT(*) as c FROM leaves l
    JOIN employees e ON e.id = l.employee_id
    WHERE e.manager_id = ? AND l.status = 'pending'
  `).get(mgrId).c;

  let docMissing = 0;
  let feedbackOverdue = 0;
  const cutoff = new Date(Date.now() - FEEDBACK_OVERDUE_DAYS * 86400000).toISOString();
  for (const r of reports) {
    const uploaded = db.prepare('SELECT DISTINCT type FROM documents WHERE employee_id = ?').all(r.id).map(d => d.type);
    if (mandatoryNames.some(n => !uploaded.includes(n))) docMissing++;
    const last = db.prepare('SELECT MAX(created_at) as t FROM feedback WHERE employee_id = ?').get(r.id);
    if (!last?.t || last.t < cutoff) feedbackOverdue++;
  }

  res.json({ total: pending + docMissing + feedbackOverdue });
});

export default router;
