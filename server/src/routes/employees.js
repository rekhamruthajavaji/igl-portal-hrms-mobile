import { Router } from 'express';
import bcrypt from 'bcryptjs';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import db, { logAudit, createNotification } from '../db.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { generateProbationLetter, createProbationLetterDoc, probationLetterFileName } from '../lib/probationLetter.js';

const router = Router();
router.use(authenticate);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.join(__dirname, '..', '..', 'data', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const employeeSelect = `
  SELECT e.*,
    u.email, u.role, u.is_active,
    d.name as department_name,
    t.name as team_name,
    m.first_name || ' ' || m.last_name as manager_name
  FROM employees e
  LEFT JOIN users u ON u.id = e.user_id
  LEFT JOIN departments d ON d.id = e.department_id
  LEFT JOIN teams t ON t.id = e.team_id
  LEFT JOIN employees m ON m.id = e.manager_id
`;

router.get('/', (req, res) => {
  let rows;
  if (req.user.role === 'admin') {
    rows = db.prepare(`${employeeSelect} ORDER BY e.first_name`).all();
  } else if (req.user.role === 'manager') {
    rows = db.prepare(`${employeeSelect} WHERE e.manager_id = ? OR e.id = ? ORDER BY e.first_name`).all(req.user.employee.id, req.user.employee.id);
  } else {
    rows = db.prepare(`${employeeSelect} WHERE e.id = ?`).all(req.user.employee.id);
  }
  res.json(rows);
});

// Probation: active employees who have completed 6 months from their joining date.
router.get('/probation', authorize('admin'), (req, res) => {
  const emps = db.prepare(`
    SELECT e.id, e.employee_code, e.first_name, e.last_name, e.designation, e.joining_date, d.name AS department_name
    FROM employees e LEFT JOIN departments d ON d.id = e.department_id
    WHERE e.employment_status = 'active' AND e.joining_date IS NOT NULL
    ORDER BY e.joining_date
  `).all();
  const today = new Date();
  const addMonths = (dateStr, m) => { const d = new Date(dateStr); d.setMonth(d.getMonth() + m); return d; };
  const monthsBetween = (from, to) => (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth()) - (to.getDate() < from.getDate() ? 1 : 0);
  const completed = [];
  for (const e of emps) {
    const completionDate = addMonths(e.joining_date, 6);
    if (completionDate <= today) {
      const pl = db.prepare("SELECT id, status, sent_at, signed_at, emailed_at FROM probation_letters WHERE employee_id = ? ORDER BY sent_at DESC LIMIT 1").get(e.id);
      completed.push({
        id: e.id, code: e.employee_code, name: `${e.first_name} ${e.last_name}`,
        designation: e.designation || '-', department: e.department_name || '-',
        joining_date: e.joining_date,
        completed_on: completionDate.toISOString().slice(0, 10),
        months: monthsBetween(new Date(e.joining_date), today),
        letter_id: pl ? pl.id : null,
        letter_status: pl ? pl.status : 'none',      // none | pending | signed
        letter_sent: !!pl, letter_sent_at: pl ? pl.sent_at : null,
        letter_signed_at: pl ? pl.signed_at : null,
        letter_emailed_at: pl ? pl.emailed_at : null,
        email_enabled: e.employee_code === 'IG-IND-0013', // emailing currently only for Rehan Feroz
      });
    }
  }
  res.json(completed);
});

// Load an employee and confirm they are eligible for a probation-confirmation letter.
// Returns { employee } on success or { error, status } to report back to the caller.
function loadEligibleForLetter(id) {
  const e = db.prepare(`SELECT id, user_id, employee_code, first_name, last_name, designation, gender, joining_date, employment_status
                        FROM employees WHERE id = ?`).get(id);
  if (!e) return { error: 'Employee not found', status: 404 };
  if (e.employment_status !== 'active') return { error: 'Employee is not active', status: 400 };
  if (!e.joining_date) return { error: 'No joining date on record', status: 400 };
  const completion = new Date(e.joining_date); completion.setMonth(completion.getMonth() + 6);
  if (completion > new Date()) return { error: 'Employee has not completed 6 months yet', status: 400 };
  return { employee: e };
}

// Generate the personalised probation-confirmation letter and deliver it to the employee's
// Documents (plus a notification). Admin-only. Re-sending simply issues a fresh copy.
router.post('/probation/:id/send-letter', authorize('admin'), async (req, res) => {
  const { employee: e, error, status } = loadEligibleForLetter(req.params.id);
  if (error) return res.status(status).json({ error });

  // Once the employee has signed, don't overwrite it with a fresh unsigned copy.
  const existing = db.prepare('SELECT * FROM probation_letters WHERE employee_id = ? ORDER BY sent_at DESC LIMIT 1').get(e.id);
  if (existing && existing.status === 'signed')
    return res.status(400).json({ error: 'This employee has already signed their confirmation letter' });

  const fileName = `${Date.now()}_Probation_Confirmation_${e.employee_code}.pdf`;
  const outPath = path.join(uploadDir, fileName);
  try {
    await generateProbationLetter(e, outPath);
  } catch (err) {
    return res.status(500).json({ error: 'Could not generate the letter' });
  }
  const size = fs.existsSync(outPath) ? fs.statSync(outPath).size : 0;

  const docId = db.prepare(`INSERT INTO documents (employee_id, name, type, file_path, size, uploaded_by)
                            VALUES (?,?,?,?,?,?)`)
    .run(e.id, 'Probation Confirmation Letter.pdf', 'Probation Letter', fileName, size, req.user.id).lastInsertRowid;

  // Track the letter for the signing flow (reuse a still-pending row on resend, else create one).
  let letterId;
  if (existing && existing.status === 'pending') {
    db.prepare('UPDATE probation_letters SET sent_by=?, sent_at=CURRENT_TIMESTAMP, document_id=? WHERE id=?')
      .run(req.user.id, docId, existing.id);
    letterId = existing.id;
  } else {
    letterId = db.prepare('INSERT INTO probation_letters (employee_id, sent_by, status, document_id) VALUES (?,?,?,?)')
      .run(e.id, req.user.id, 'pending', docId).lastInsertRowid;
  }

  if (e.user_id) {
    createNotification(e.user_id, 'Probation confirmation letter — action needed',
      'Congratulations on completing your probation! Please review and digitally sign your confirmation letter.',
      'document', '/probation-letter');
  }
  logAudit(req.user.id, 'send_probation_letter', 'employee', e.id, { documentId: docId, letterId });
  res.status(201).json({ ok: true, documentId: docId, letterId });
});

// Stream the letter straight back as a downloadable PDF (admin gets a copy to keep/print).
router.get('/probation/:id/letter', authorize('admin'), (req, res) => {
  const { employee: e, error, status } = loadEligibleForLetter(req.params.id);
  if (error) return res.status(status).json({ error });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${probationLetterFileName(e)}"`);
  const doc = createProbationLetterDoc(e);
  doc.pipe(res);
  doc.end();
});

router.get('/:id', (req, res) => {
  const row = db.prepare(`${employeeSelect} WHERE e.id = ?`).get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  if (req.user.role === 'employee' && row.id !== req.user.employee.id) return res.status(403).json({ error: 'Forbidden' });
  res.json(row);
});

router.post('/', authorize('admin'), (req, res) => {
  const b = req.body || {};
  if (!b.email || !b.first_name || !b.last_name || !b.joining_date) {
    return res.status(400).json({ error: 'email, first_name, last_name, joining_date required' });
  }
  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(b.email.toLowerCase());
  if (exists) return res.status(409).json({ error: 'Email already exists' });
  const password = b.password || 'Password@123';
  const hash = bcrypt.hashSync(password, 10);
  const role = b.role || 'employee';
  const userId = db.prepare('INSERT INTO users (email, password_hash, role) VALUES (?,?,?)').run(b.email.toLowerCase(), hash, role).lastInsertRowid;
  const code = b.employee_code || `IGN${String(userId).padStart(4, '0')}`;
  const result = db.prepare(`INSERT INTO employees
    (user_id, employee_code, first_name, last_name, phone, dob, gender, address, state, joining_date, designation, department_id, team_id, manager_id, bank_name, bank_account, ifsc, pan, basic_salary, hra, allowances, deductions)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    userId, code, b.first_name, b.last_name, b.phone, b.dob, b.gender, b.address, b.state, b.joining_date, b.designation,
    b.department_id || null, b.team_id || null, b.manager_id || null,
    b.bank_name, b.bank_account, b.ifsc, b.pan,
    b.basic_salary || 0, b.hra || 0, b.allowances || 0, b.deductions || 0
  );
  // initialize leave balances for current year prorata
  initLeaveBalances(result.lastInsertRowid, b.joining_date, b.gender);
  logAudit(req.user.id, 'create', 'employee', result.lastInsertRowid, { email: b.email });
  res.status(201).json({ id: result.lastInsertRowid, defaultPassword: password });
});

// Employee self-service: update your OWN contact + bank details. Never email, role, salary, or password.
router.put('/self', (req, res) => {
  if (!req.user.employee) return res.status(400).json({ error: 'No employee profile' });
  const id = req.user.employee.id;
  const b = req.body || {};
  const allowed = ['phone', 'dob', 'gender', 'address', 'state', 'bank_name', 'bank_account', 'ifsc', 'pan'];
  const set = allowed.filter(f => f in b).map(f => `${f} = @${f}`).join(', ');
  if (!set) return res.json({ ok: true });
  const data = { id };
  allowed.forEach(f => { if (f in b) data[f] = b[f]; });
  db.prepare(`UPDATE employees SET ${set} WHERE id = @id`).run(data);
  // Keep HR in the loop when payroll-sensitive bank details change.
  if ('bank_account' in b || 'ifsc' in b || 'bank_name' in b) {
    const who = `${req.user.employee.first_name} ${req.user.employee.last_name}`;
    db.prepare("SELECT id FROM users WHERE role = 'admin' AND is_active = 1").all()
      .forEach(a => createNotification(a.id, 'Bank details updated', `${who} updated their bank details.`, 'info', `/employees/${id}`));
  }
  logAudit(req.user.id, 'self_update', 'employee', id, { fields: Object.keys(b) });
  res.json({ ok: true });
});

router.put('/:id', authorize('admin'), (req, res) => {
  const b = req.body || {};
  const fields = ['first_name','last_name','phone','dob','gender','address','state','joining_date','designation','department_id','team_id','manager_id','employment_status','bank_name','bank_account','ifsc','pan','basic_salary','hra','allowances','deductions'];
  const set = fields.filter(f => f in b).map(f => `${f} = @${f}`).join(', ');
  // Nothing to change at all (no employee fields AND no email/role) → no-op.
  if (!set && !b.email && !b.role) return res.json({ ok: true });
  const data = { id: req.params.id };
  fields.forEach(f => { if (f in b) data[f] = b[f]; });
  if (set) db.prepare(`UPDATE employees SET ${set} WHERE id = @id`).run(data);
  if (b.email || b.role) {
    const emp = db.prepare('SELECT user_id FROM employees WHERE id = ?').get(req.params.id);
    if (b.email) db.prepare('UPDATE users SET email = ? WHERE id = ?').run(b.email.toLowerCase(), emp.user_id);
    if (b.role) db.prepare('UPDATE users SET role = ? WHERE id = ?').run(b.role, emp.user_id);
  }
  logAudit(req.user.id, 'update', 'employee', req.params.id);
  res.json({ ok: true });
});

router.delete('/:id', authorize('admin'), (req, res) => {
  const emp = db.prepare('SELECT user_id FROM employees WHERE id = ?').get(req.params.id);
  if (!emp) return res.status(404).json({ error: 'Not found' });
  db.prepare('UPDATE users SET is_active = 0 WHERE id = ?').run(emp.user_id);
  db.prepare("UPDATE employees SET employment_status = 'inactive' WHERE id = ?").run(req.params.id);
  logAudit(req.user.id, 'deactivate', 'employee', req.params.id);
  res.json({ ok: true });
});

router.post('/:id/reset-password', authorize('admin'), (req, res) => {
  const emp = db.prepare('SELECT user_id FROM employees WHERE id = ?').get(req.params.id);
  if (!emp) return res.status(404).json({ error: 'Not found' });
  const newPass = req.body.password || 'Password@123';
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(newPass, 10), emp.user_id);
  createNotification(emp.user_id, 'Password reset', 'Your password was reset by HR. Please log in and change it.', 'security');
  logAudit(req.user.id, 'reset_password', 'user', emp.user_id);
  res.json({ ok: true, password: newPass });
});

function initLeaveBalances(employeeId, joiningDate, gender) {
  const year = new Date().getFullYear();
  const types = db.prepare('SELECT * FROM leave_types').all();
  const joinedThisYear = new Date(joiningDate).getFullYear() === year;
  const monthsRemaining = joinedThisYear ? Math.max(1, 12 - new Date(joiningDate).getMonth()) : 12;
  for (const t of types) {
    if (t.gender_specific && gender && t.gender_specific.toLowerCase() !== gender.toLowerCase()) continue;
    const total = Math.round((t.days_per_year * monthsRemaining / 12) * 10) / 10;
    db.prepare('INSERT OR IGNORE INTO leave_balances (employee_id, leave_type_id, year, total, used) VALUES (?,?,?,?,0)').run(employeeId, t.id, year, total);
  }
}

export default router;
export { initLeaveBalances };
