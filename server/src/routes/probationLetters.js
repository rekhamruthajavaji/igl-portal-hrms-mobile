import { Router } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import db, { logAudit, createNotification } from '../db.js';
import { authenticate, authorize } from '../middleware/auth.js';
import {
  generateProbationLetter, createProbationLetterDoc, probationLetterData,
  probationLetterToBuffer, probationLetterFileName, COMPANY, ADDRESS, SIGNATORY,
} from '../lib/probationLetter.js';
import { sendMail, mailConfigured } from '../lib/mailer.js';

const router = Router();
router.use(authenticate);

// For now, emailing the signed letter is enabled only for Rehan Feroz.
const EMAIL_ENABLED_CODES = ['IG-IND-0013'];

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.join(__dirname, '..', '..', 'data', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const EMP_COLS = `id, user_id, employee_code, first_name, last_name, designation, gender, joining_date`;

// Full letter row joined with the employee it belongs to.
function getLetter(id) {
  return db.prepare(`
    SELECT pl.*, e.user_id AS emp_user_id, e.employee_code, e.first_name, e.last_name, e.designation, e.gender, e.joining_date
    FROM probation_letters pl JOIN employees e ON e.id = pl.employee_id
    WHERE pl.id = ?`).get(id);
}
const empFromLetter = (l) => ({
  id: l.employee_id, user_id: l.emp_user_id, employee_code: l.employee_code,
  first_name: l.first_name, last_name: l.last_name, designation: l.designation,
  gender: l.gender, joining_date: l.joining_date,
});
const canAccess = (req, l) =>
  req.user.role === 'admin' || (req.user.employee && req.user.employee.id === l.employee_id);

// Small summary for the sidebar: does this employee have letters, and how many await signing.
router.get('/summary', (req, res) => {
  if (!req.user.employee) return res.json({ total: 0, pending: 0 });
  const r = db.prepare(`SELECT COUNT(*) AS total, SUM(status='pending') AS pending
                        FROM probation_letters WHERE employee_id = ?`).get(req.user.employee.id);
  res.json({ total: r.total || 0, pending: r.pending || 0 });
});

// The signed-in employee's own letters.
router.get('/mine', (req, res) => {
  if (!req.user.employee) return res.json([]);
  const rows = db.prepare(`SELECT id, status, sent_at, signed_at FROM probation_letters
                           WHERE employee_id = ? ORDER BY sent_at DESC`).all(req.user.employee.id);
  res.json(rows);
});

// Admin: every letter with employee + status, for tracking who has signed.
router.get('/', authorize('admin'), (_req, res) => {
  const rows = db.prepare(`
    SELECT pl.id, pl.status, pl.sent_at, pl.signed_at,
           e.employee_code, e.first_name || ' ' || e.last_name AS name
    FROM probation_letters pl JOIN employees e ON e.id = pl.employee_id
    ORDER BY pl.sent_at DESC`).all();
  res.json(rows);
});

// Structured data to render the letter on screen (owner or admin).
router.get('/:id/data', (req, res) => {
  const l = getLetter(req.params.id);
  if (!l) return res.status(404).json({ error: 'Letter not found' });
  if (!canAccess(req, l)) return res.status(403).json({ error: 'Forbidden' });
  const L = probationLetterData(empFromLetter(l));
  res.json({
    id: l.id, status: l.status, sentAt: l.sent_at, signedAt: l.signed_at,
    signature: l.signature || null,
    company: { name: COMPANY, address: ADDRESS },
    signatory: SIGNATORY,
    ...L,
    employeeCode: l.employee_code,
  });
});

// Download the letter PDF — signed copy once signed, otherwise the unsigned version (owner or admin).
router.get('/:id/pdf', (req, res) => {
  const l = getLetter(req.params.id);
  if (!l) return res.status(404).json({ error: 'Letter not found' });
  if (!canAccess(req, l)) return res.status(403).json({ error: 'Forbidden' });
  const emp = empFromLetter(l);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${probationLetterFileName(emp)}"`);
  const opts = l.status === 'signed' ? { signature: l.signature, signedDate: fmtDate(l.signed_at) } : {};
  const doc = createProbationLetterDoc(emp, opts);
  doc.pipe(res);
  doc.end();
});

// Employee signs their own letter. Body: { signature } (PNG data URL from the signature pad).
router.post('/:id/sign', async (req, res) => {
  const l = getLetter(req.params.id);
  if (!l) return res.status(404).json({ error: 'Letter not found' });
  if (!req.user.employee || req.user.employee.id !== l.employee_id)
    return res.status(403).json({ error: 'You can only sign your own letter' });
  if (l.status === 'signed') return res.status(400).json({ error: 'This letter has already been signed' });

  const { signature } = req.body || {};
  if (!signature || !/^data:image\/(png|jpeg);base64,/.test(signature))
    return res.status(400).json({ error: 'A signature is required' });

  const signedAt = new Date().toISOString();
  const emp = empFromLetter(l);

  // Generate the signed PDF and store it as a document the employee keeps.
  const fileName = `${Date.now()}_Probation_Confirmation_Signed_${emp.employee_code}.pdf`;
  const outPath = path.join(uploadDir, fileName);
  try {
    await generateProbationLetter(emp, outPath, { signature, signedDate: fmtDate(signedAt) });
  } catch (err) {
    return res.status(500).json({ error: 'Could not generate the signed letter' });
  }
  const size = fs.existsSync(outPath) ? fs.statSync(outPath).size : 0;
  const signedDocId = db.prepare(`INSERT INTO documents (employee_id, name, type, file_path, size, uploaded_by)
                                  VALUES (?,?,?,?,?,?)`)
    .run(emp.id, 'Probation Confirmation Letter (Signed).pdf', 'Probation Letter', fileName, size, req.user.id).lastInsertRowid;

  db.prepare(`UPDATE probation_letters SET status='signed', signature=?, signed_at=?, signed_document_id=? WHERE id=?`)
    .run(signature, signedAt, signedDocId, l.id);

  // Let the admins know it was signed.
  const who = `${emp.first_name} ${emp.last_name}`;
  db.prepare("SELECT id FROM users WHERE role = 'admin' AND is_active = 1").all()
    .forEach(a => createNotification(a.id, 'Probation letter signed',
      `${who} has digitally signed their probation confirmation letter.`, 'document', '/probation'));

  logAudit(req.user.id, 'sign_probation_letter', 'probation_letter', l.id);
  res.json({ ok: true, signedAt });
});

// Admin emails the signed letter to the employee + admins, with the signed PDF attached.
// Currently restricted to Rehan Feroz.
router.post('/:id/email', authorize('admin'), async (req, res) => {
  const l = getLetter(req.params.id);
  if (!l) return res.status(404).json({ error: 'Letter not found' });
  if (l.status !== 'signed') return res.status(400).json({ error: 'This letter has not been signed yet' });
  if (!EMAIL_ENABLED_CODES.includes(l.employee_code))
    return res.status(400).json({ error: 'Emailing is currently enabled only for Rehan Feroz' });
  if (!mailConfigured())
    return res.status(503).json({ error: 'Email is not set up yet. Add the SMTP_* settings to the server .env, then try again.' });

  const emp = empFromLetter(l);
  const fullName = `${emp.first_name} ${emp.last_name}`;

  // Recipients: the employee + every active admin (deduplicated).
  const empUser = db.prepare('SELECT email FROM users WHERE id = ?').get(l.emp_user_id);
  const admins = db.prepare("SELECT email FROM users WHERE role='admin' AND is_active=1").all().map(a => a.email);
  const recipients = [...new Set([empUser?.email, ...admins].filter(Boolean))];
  if (recipients.length === 0) return res.status(400).json({ error: 'No recipient email addresses found' });

  let pdf;
  try {
    pdf = await probationLetterToBuffer(emp, { signature: l.signature, signedDate: fmtDate(l.signed_at) });
  } catch { return res.status(500).json({ error: 'Could not generate the signed letter' }); }

  const subject = `Probation Confirmation Letter — ${fullName} (Signed)`;
  const text =
`Dear Team,

Please find attached the digitally signed Probation Confirmation Letter for ${fullName} (Employee ID: ${emp.employee_code}).

${fullName} has successfully completed the probationary period and has acknowledged and accepted the confirmation of employment. The signed letter is enclosed for your records.

Warm regards,
IGENIE LABS PRIVATE LIMITED
Human Resources`;
  const html =
`<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#1f2430;line-height:1.6">
  <p>Dear Team,</p>
  <p>Please find attached the digitally signed <strong>Probation Confirmation Letter</strong> for
     <strong>${fullName}</strong> (Employee ID: ${emp.employee_code}).</p>
  <p>${fullName} has successfully completed the probationary period and has acknowledged and accepted the
     confirmation of employment. The signed letter is enclosed for your records.</p>
  <p>Warm regards,<br/><strong>IGENIE LABS PRIVATE LIMITED</strong><br/>Human Resources</p>
</div>`;

  try {
    await sendMail({
      to: recipients, subject, text, html,
      attachments: [{ filename: probationLetterFileName(emp), content: pdf, contentType: 'application/pdf' }],
    });
  } catch (err) {
    return res.status(502).json({ error: 'Could not send the email: ' + (err.message || 'unknown error') });
  }

  const emailedAt = new Date().toISOString();
  db.prepare('UPDATE probation_letters SET emailed_at = ? WHERE id = ?').run(emailedAt, l.id);
  logAudit(req.user.id, 'email_probation_letter', 'probation_letter', l.id, { recipients });
  res.json({ ok: true, recipients, emailedAt });
});

// dd/mm/yyyy for display inside the PDF.
function fmtDate(iso) {
  const d = new Date(iso); const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export default router;
