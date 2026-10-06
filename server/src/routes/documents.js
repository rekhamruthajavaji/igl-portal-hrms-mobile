import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import db, { logAudit } from '../db.js';
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
    cb(null, `${Date.now()}_${safe}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

export const REQUIRED_DOC_TYPES = [
  { code: 'aadhar',      name: 'Aadhar Card',            mandatory: true },
  { code: 'pan',         name: 'PAN Card',               mandatory: true },
  { code: 'offer',       name: 'Offer Letter',           mandatory: true },
  { code: 'pc',          name: 'Provisional Certificate', mandatory: true },
  { code: 'experience',  name: 'Experience Certificate', mandatory: false },
];

router.get('/types', (_req, res) => res.json(REQUIRED_DOC_TYPES));

// Returns per-employee mandatory document completion (admin/manager view).
router.get('/status', (req, res) => {
  if (req.user.role === 'employee') return res.status(403).json({ error: 'Forbidden' });
  const empQuery = req.user.role === 'manager'
    ? db.prepare("SELECT id, employee_code, first_name, last_name FROM employees WHERE employment_status = 'active' AND (manager_id = ? OR id = ?)").all(req.user.employee.id, req.user.employee.id)
    : db.prepare("SELECT id, employee_code, first_name, last_name FROM employees WHERE employment_status = 'active'").all();
  const mandatory = REQUIRED_DOC_TYPES.filter(t => t.mandatory);
  const rows = empQuery.map(e => {
    const docs = db.prepare('SELECT type FROM documents WHERE employee_id = ?').all(e.id).map(d => d.type);
    const have = mandatory.filter(m => docs.includes(m.name));
    const missing = mandatory.filter(m => !docs.includes(m.name));
    return {
      employee_id: e.id,
      employee_code: e.employee_code,
      name: `${e.first_name} ${e.last_name}`,
      total_required: mandatory.length,
      uploaded: have.length,
      missing: missing.map(m => m.name),
      complete: missing.length === 0,
    };
  });
  res.json(rows);
});

router.get('/', (req, res) => {
  const empId = req.query.employee_id;
  if (req.user.role === 'employee') {
    const rows = db.prepare('SELECT * FROM documents WHERE employee_id = ? ORDER BY uploaded_at DESC').all(req.user.employee.id);
    return res.json(rows);
  }
  if (empId) {
    const rows = db.prepare('SELECT * FROM documents WHERE employee_id = ? ORDER BY uploaded_at DESC').all(empId);
    return res.json(rows);
  }
  const rows = db.prepare(`SELECT d.*, e.first_name || ' ' || e.last_name as employee_name, e.employee_code
    FROM documents d JOIN employees e ON e.id = d.employee_id ORDER BY d.uploaded_at DESC`).all();
  res.json(rows);
});

router.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const empId = req.body.employee_id || req.user.employee.id;
  if (req.user.role === 'employee' && Number(empId) !== req.user.employee.id) return res.status(403).json({ error: 'Forbidden' });
  const id = db.prepare(`INSERT INTO documents (employee_id, name, type, file_path, size, uploaded_by)
    VALUES (?,?,?,?,?,?)`).run(empId, req.body.name || req.file.originalname, req.body.type || null, req.file.filename, req.file.size, req.user.id).lastInsertRowid;
  logAudit(req.user.id, 'upload', 'document', id);
  res.status(201).json({ id });
});

router.get('/:id/download', (req, res) => {
  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Not found' });
  if (req.user.role === 'employee' && doc.employee_id !== req.user.employee.id) return res.status(403).json({ error: 'Forbidden' });
  const filePath = path.join(uploadDir, doc.file_path);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File missing' });
  res.download(filePath, doc.name);
});

router.delete('/:id', authorize('admin'), (req, res) => {
  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Not found' });
  const filePath = path.join(uploadDir, doc.file_path);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  db.prepare('DELETE FROM documents WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

export default router;
