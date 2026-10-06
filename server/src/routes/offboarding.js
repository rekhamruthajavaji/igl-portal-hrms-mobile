import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import db, { logAudit, createNotification } from '../db.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = Router();
router.use(authenticate);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.join(__dirname, '..', '..', 'data', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `ob_${Date.now()}_${safe}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

// The 9 mandatory exit clearances the manager must provide.
export const CLEARANCE_ITEMS = [
  { key: 'relieving_letter',   label: 'Relieving Letter',          kind: 'file' },
  { key: 'experience_letter',  label: 'Experience Letter',         kind: 'file' },
  { key: 'payslips_3m',        label: '3 Months Pay Slip',         kind: 'file' },
  { key: 'fnf_settlement',     label: 'F & F Settlement',          kind: 'file' },
  { key: 'form_16',            label: 'Form 16',                   kind: 'file' },
  { key: 'health_insurance',   label: 'Health Insurance Details',  kind: 'text' },
  { key: 'asset_confirmation', label: 'Asset Submit Confirmation', kind: 'text' },
  { key: 'no_due_clearance',   label: 'No Due Clearance',          kind: 'text' },
  { key: 'references_contact', label: 'References Contact Number',  kind: 'text' },
];

const empName = (e) => e ? `${e.first_name} ${e.last_name}` : '';

function getRecord(id) {
  const ob = db.prepare(`
    SELECT o.*,
      e.first_name || ' ' || e.last_name AS employee_name, e.employee_code,
      m.first_name || ' ' || m.last_name AS manager_name
    FROM offboardings o
    LEFT JOIN employees e ON e.id = o.employee_id
    LEFT JOIN employees m ON m.id = o.manager_id
    WHERE o.id = ?`).get(id);
  if (!ob) return null;
  ob.items = db.prepare('SELECT * FROM offboarding_items WHERE offboarding_id = ? ORDER BY id').all(id);
  ob.total = ob.items.length;
  ob.submitted = ob.items.filter(i => i.submitted).length;
  return ob;
}

// Can the current user act as the clearance provider for this record?
const canManage = (req, ob) =>
  req.user.role === 'admin' ||
  (req.user.role === 'manager' && ob.manager_id === req.user.employee?.id);

// === HR initiates off-boarding ===
router.post('/', authorize('admin'), (req, res) => {
  const { employee_id, last_day, reason, notes } = req.body || {};
  if (!employee_id) return res.status(400).json({ error: 'employee_id required' });
  const emp = db.prepare('SELECT * FROM employees WHERE id = ?').get(employee_id);
  if (!emp) return res.status(404).json({ error: 'Employee not found' });

  const active = db.prepare("SELECT id FROM offboardings WHERE employee_id = ? AND status IN ('pending_manager','cleared')").get(employee_id);
  if (active) return res.status(409).json({ error: 'An off-boarding is already in progress for this employee' });

  const id = db.prepare(`INSERT INTO offboardings (employee_id, manager_id, initiated_by, last_day, reason, notes)
    VALUES (?,?,?,?,?,?)`).run(employee_id, emp.manager_id || null, req.user.id, last_day || null, reason || null, notes || null).lastInsertRowid;

  const insItem = db.prepare('INSERT INTO offboarding_items (offboarding_id, item_key, label, kind) VALUES (?,?,?,?)');
  for (const it of CLEARANCE_ITEMS) insItem.run(id, it.key, it.label, it.kind);

  // Notify the manager who must provide clearances
  if (emp.manager_id) {
    const mgr = db.prepare('SELECT user_id FROM employees WHERE id = ?').get(emp.manager_id);
    if (mgr?.user_id) {
      createNotification(mgr.user_id, 'Off-boarding approval needed',
        `HR has started off-boarding for ${empName(emp)} (reason: ${req.body.reason || 'not specified'}). Please review and approve to begin the exit clearances.`,
        'offboarding', '/offboarding');
    }
  }
  logAudit(req.user.id, 'offboarding_initiated', 'employee', employee_id);
  res.status(201).json(getRecord(id));
});

// === HR: list all off-boardings ===
router.get('/', authorize('admin'), (_req, res) => {
  const rows = db.prepare(`
    SELECT o.*,
      e.first_name || ' ' || e.last_name AS employee_name, e.employee_code,
      m.first_name || ' ' || m.last_name AS manager_name,
      (SELECT COUNT(*) FROM offboarding_items i WHERE i.offboarding_id = o.id) AS total,
      (SELECT COUNT(*) FROM offboarding_items i WHERE i.offboarding_id = o.id AND i.submitted = 1) AS submitted
    FROM offboardings o
    LEFT JOIN employees e ON e.id = o.employee_id
    LEFT JOIN employees m ON m.id = o.manager_id
    ORDER BY o.created_at DESC`).all();
  res.json(rows);
});

// === Manager: off-boardings assigned to me ===
router.get('/manager', authorize('manager', 'admin'), (req, res) => {
  const mgrId = req.user.employee?.id;
  const rows = db.prepare(`
    SELECT o.*, e.first_name || ' ' || e.last_name AS employee_name, e.employee_code
    FROM offboardings o LEFT JOIN employees e ON e.id = o.employee_id
    WHERE o.manager_id = ? AND o.status = 'pending_manager'
    ORDER BY o.created_at DESC`).all(mgrId);
  res.json(rows.map(r => getRecord(r.id)));
});

// === Employee: my off-boarding (to view submitted documents) ===
router.get('/employee', (req, res) => {
  const empId = req.user.employee?.id;
  if (!empId) return res.json(null);
  const row = db.prepare("SELECT id FROM offboardings WHERE employee_id = ? ORDER BY created_at DESC LIMIT 1").get(empId);
  res.json(row ? getRecord(row.id) : null);
});

router.get('/:id', (req, res) => {
  const ob = getRecord(req.params.id);
  if (!ob) return res.status(404).json({ error: 'Not found' });
  const isEmployee = req.user.role === 'employee' && ob.employee_id === req.user.employee?.id;
  if (!canManage(req, ob) && !isEmployee) return res.status(403).json({ error: 'Forbidden' });
  res.json(ob);
});

// === Manager approves the request -> clearance stage begins ===
router.post('/:id/approve', (req, res) => {
  const ob = getRecord(req.params.id);
  if (!ob) return res.status(404).json({ error: 'Not found' });
  if (!canManage(req, ob)) return res.status(403).json({ error: 'Forbidden' });
  if (ob.status !== 'pending_manager') return res.status(400).json({ error: 'Cannot approve at this stage' });
  if (!ob.manager_approved) {
    db.prepare('UPDATE offboardings SET manager_approved = 1, approved_at = CURRENT_TIMESTAMP WHERE id = ?').run(ob.id);
    logAudit(req.user.id, 'offboarding_approved', 'offboarding', ob.id);
  }
  res.json(getRecord(ob.id));
});

// === Manager declines the request ===
router.post('/:id/decline', (req, res) => {
  const ob = getRecord(req.params.id);
  if (!ob) return res.status(404).json({ error: 'Not found' });
  if (!canManage(req, ob)) return res.status(403).json({ error: 'Forbidden' });
  if (ob.status !== 'pending_manager') return res.status(400).json({ error: 'Cannot decline at this stage' });
  db.prepare("UPDATE offboardings SET status = 'cancelled' WHERE id = ?").run(ob.id);
  if (ob.initiated_by) {
    createNotification(ob.initiated_by, 'Off-boarding declined',
      `${ob.employee_name}'s manager declined the off-boarding request.`, 'offboarding', '/offboarding');
  }
  logAudit(req.user.id, 'offboarding_declined', 'offboarding', ob.id);
  res.json(getRecord(ob.id));
});

// === Manager submits one clearance item (file or text) ===
router.post('/:id/items/:key', upload.single('file'), (req, res) => {
  const ob = getRecord(req.params.id);
  if (!ob) return res.status(404).json({ error: 'Not found' });
  if (!canManage(req, ob)) return res.status(403).json({ error: 'Forbidden' });
  if (ob.status !== 'pending_manager') return res.status(400).json({ error: 'This off-boarding is no longer editable' });
  if (!ob.manager_approved) return res.status(400).json({ error: 'Approve the off-boarding before submitting clearances' });

  const item = db.prepare('SELECT * FROM offboarding_items WHERE offboarding_id = ? AND item_key = ?').get(ob.id, req.params.key);
  if (!item) return res.status(404).json({ error: 'Unknown clearance item' });

  if (item.kind === 'file') {
    if (!req.file) return res.status(400).json({ error: 'File required' });
    db.prepare('UPDATE offboarding_items SET file_path = ?, file_name = ?, submitted = 1, submitted_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(req.file.filename, req.file.originalname, item.id);
  } else {
    const value = (req.body.value || '').trim();
    if (!value) return res.status(400).json({ error: 'Value required' });
    db.prepare('UPDATE offboarding_items SET value = ?, submitted = 1, submitted_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(value, item.id);
  }
  res.json(getRecord(ob.id));
});

// === Manager finalizes: all clearances done -> notify HR ===
router.post('/:id/submit', (req, res) => {
  const ob = getRecord(req.params.id);
  if (!ob) return res.status(404).json({ error: 'Not found' });
  if (!canManage(req, ob)) return res.status(403).json({ error: 'Forbidden' });
  if (ob.status !== 'pending_manager') return res.status(400).json({ error: 'Already submitted' });
  if (!ob.manager_approved) return res.status(400).json({ error: 'Approve the off-boarding first' });
  const pending = ob.items.filter(i => !i.submitted);
  if (pending.length) return res.status(400).json({ error: `${pending.length} clearance(s) still pending` });

  db.prepare("UPDATE offboardings SET status = 'cleared', cleared_at = CURRENT_TIMESTAMP WHERE id = ?").run(ob.id);

  // Notify HR (initiator) that everything is ready
  if (ob.initiated_by) {
    createNotification(ob.initiated_by, 'Exit clearances completed',
      `All clearances for ${ob.employee_name} are complete. You can now off-board this employee.`,
      'offboarding', '/offboarding');
  }
  // Let the employee know their exit documents are available
  const emp = db.prepare('SELECT user_id FROM employees WHERE id = ?').get(ob.employee_id);
  if (emp?.user_id) {
    createNotification(emp.user_id, 'Exit documents available',
      'Your relieving documents and exit clearances have been shared. You can view them under Off-boarding.',
      'offboarding', '/offboarding');
  }
  logAudit(req.user.id, 'offboarding_cleared', 'offboarding', ob.id);
  res.json(getRecord(ob.id));
});

// === HR completes off-boarding: deactivate the employee ===
router.post('/:id/complete', authorize('admin'), (req, res) => {
  const ob = getRecord(req.params.id);
  if (!ob) return res.status(404).json({ error: 'Not found' });
  if (ob.status !== 'cleared') return res.status(400).json({ error: 'Clearances are not complete yet' });

  const emp = db.prepare('SELECT user_id FROM employees WHERE id = ?').get(ob.employee_id);
  if (emp?.user_id) db.prepare('UPDATE users SET is_active = 0 WHERE id = ?').run(emp.user_id);
  db.prepare("UPDATE employees SET employment_status = 'inactive' WHERE id = ?").run(ob.employee_id);
  db.prepare("UPDATE offboardings SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = ?").run(ob.id);
  logAudit(req.user.id, 'offboarding_completed', 'employee', ob.employee_id);
  res.json(getRecord(ob.id));
});

// === Download a clearance file (HR, owning manager, or the employee) ===
router.get('/:id/items/:itemId/download', (req, res) => {
  const ob = getRecord(req.params.id);
  if (!ob) return res.status(404).json({ error: 'Not found' });
  const isEmployee = req.user.role === 'employee' && ob.employee_id === req.user.employee?.id;
  if (!canManage(req, ob) && !isEmployee) return res.status(403).json({ error: 'Forbidden' });
  const item = db.prepare('SELECT * FROM offboarding_items WHERE id = ? AND offboarding_id = ?').get(req.params.itemId, ob.id);
  if (!item || !item.file_path) return res.status(404).json({ error: 'File not found' });
  const filePath = path.join(uploadDir, item.file_path);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File missing' });
  res.download(filePath, item.file_name || item.label);
});

export default router;
