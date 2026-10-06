import { Router } from 'express';
import PDFDocument from 'pdfkit';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import db, { logAudit, createNotification } from '../db.js';
import { authenticate, authorize } from '../middleware/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOGO_PATH = path.join(__dirname, '..', '..', '..', 'client', 'public', 'logo.png');
// Bundled Unicode font (Hind, SIL OFL) so the payslip PDF can render the ₹ glyph,
// which pdfkit's built-in Helvetica (WinAnsi) lacks. Works on the Linux deploy too.
const FONT_REG = path.join(__dirname, '..', 'assets', 'fonts', 'Hind-Regular.ttf');
const FONT_SEMI = path.join(__dirname, '..', 'assets', 'fonts', 'Hind-SemiBold.ttf');
const FONT_BOLD = path.join(__dirname, '..', 'assets', 'fonts', 'Hind-Bold.ttf');

const router = Router();
router.use(authenticate);

router.get('/', (req, res) => {
  const month = Number(req.query.month);
  const year = Number(req.query.year);
  const base = `
    SELECT p.*, e.first_name || ' ' || e.last_name as employee_name, e.employee_code, e.designation
    FROM payroll p JOIN employees e ON e.id = p.employee_id
  `;
  const filters = [];
  const params = [];
  if (month) { filters.push('p.month = ?'); params.push(month); }
  if (year) { filters.push('p.year = ?'); params.push(year); }
  if (req.user.role === 'employee') { filters.push('p.employee_id = ?'); params.push(req.user.employee.id); }
  else if (req.user.role === 'manager') { filters.push('(e.manager_id = ? OR e.id = ?)'); params.push(req.user.employee.id, req.user.employee.id); }
  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  res.json(db.prepare(`${base} ${where} ORDER BY p.year DESC, p.month DESC`).all(...params));
});

router.post('/generate', authorize('admin'), (req, res) => {
  const month = Number(req.body.month) || new Date().getMonth() + 1;
  const year = Number(req.body.year) || new Date().getFullYear();
  const employees = db.prepare("SELECT * FROM employees WHERE employment_status = 'active'").all();
  const monthStr = String(month).padStart(2, '0');
  const from = `${year}-${monthStr}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const to = `${year}-${monthStr}-${String(lastDay).padStart(2, '0')}`;
  let generated = 0;
  for (const e of employees) {
    const attendance = db.prepare(`SELECT COUNT(*) as c FROM attendance WHERE employee_id = ? AND date BETWEEN ? AND ?`).get(e.id, from, to);
    const approvedLeave = db.prepare(`SELECT COALESCE(SUM(days),0) as d FROM leaves WHERE employee_id = ? AND status = 'approved' AND ((start_date BETWEEN ? AND ?) OR (end_date BETWEEN ? AND ?))`).get(e.id, from, to, from, to);
    const workingDays = lastDay;
    const paidDays = Math.min(workingDays, attendance.c + approvedLeave.d);
    const ratio = workingDays > 0 ? paidDays / workingDays : 1;
    const basic = Math.round(e.basic_salary * ratio);
    const hra = Math.round(e.hra * ratio);
    const allowances = Math.round(e.allowances * ratio);
    const deductions = e.deductions;
    const gross = basic + hra + allowances;
    const net = gross - deductions;
    db.prepare(`INSERT OR REPLACE INTO payroll (employee_id, month, year, basic, hra, allowances, deductions, gross_pay, net_pay, working_days, paid_days)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(e.id, month, year, basic, hra, allowances, deductions, gross, net, workingDays, paidDays);
    createNotification(e.user_id, 'Payslip available', `Your payslip for ${monthStr}/${year} has been generated`, 'payroll', '/payslips');
    generated++;
  }
  logAudit(req.user.id, 'generate_payroll', 'payroll', null, { month, year, generated });
  res.json({ ok: true, generated });
});

// Run sheet: every active employee with monthly gross, standard deductions and remaining paid-leave balance.
router.get('/run-sheet', authorize('admin'), (req, res) => {
  const year = Number(req.query.year) || new Date().getFullYear();
  const emps = db.prepare(`
    SELECT id, employee_code, first_name, last_name, designation, basic_salary, hra, allowances, deductions
    FROM employees WHERE employment_status = 'active' ORDER BY first_name
  `).all();
  const balStmt = db.prepare(`
    SELECT COALESCE(SUM(lb.total - lb.used), 0) AS rem
    FROM leave_balances lb JOIN leave_types lt ON lt.id = lb.leave_type_id
    WHERE lb.employee_id = ? AND lb.year = ? AND lt.is_paid = 1 AND lt.code NOT IN ('WFH','ML','PL')
  `);
  res.json(emps.map(e => ({
    id: e.id,
    code: e.employee_code,
    name: `${e.first_name} ${e.last_name}`,
    designation: e.designation || '-',
    basic: e.basic_salary,
    hra: e.hra,
    special: e.allowances,
    gross: e.basic_salary + e.hra + e.allowances,
    deductions: e.deductions,
    paidLeaveLeft: Math.round(balStmt.get(e.id, year).rem * 10) / 10,
  })));
});

// Run payroll from admin-entered attended days; deducts Loss of Pay and notifies each employee.
router.post('/run', authorize('admin'), (req, res) => {
  const m = Number(req.body?.month), y = Number(req.body?.year), dim = Number(req.body?.daysInMonth);
  const entries = req.body?.entries;
  if (!m || !y || !dim || dim <= 0 || !Array.isArray(entries)) {
    return res.status(400).json({ error: 'month, year, daysInMonth and entries are required' });
  }
  let generated = 0;
  const run = db.transaction(() => {
    for (const en of entries) {
      const emp = db.prepare("SELECT * FROM employees WHERE id = ? AND employment_status = 'active'").get(en.employeeId);
      if (!emp) continue;
      const attended = Math.max(0, Math.min(dim, Number(en.attendedDays)));
      const lopDays = Math.round((dim - attended) * 100) / 100;
      const gross = emp.basic_salary + emp.hra + emp.allowances;
      const lopAmount = Math.round(gross * lopDays / dim);
      const netPay = gross - emp.deductions - lopAmount;
      db.prepare(`INSERT OR REPLACE INTO payroll
        (employee_id, month, year, basic, hra, allowances, deductions, gross_pay, net_pay, working_days, paid_days, lop_days, lop_amount)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
        emp.id, m, y, emp.basic_salary, emp.hra, emp.allowances, emp.deductions, gross, netPay, dim, attended, lopDays, lopAmount
      );
      createNotification(emp.user_id, 'Payslip available', `Your payslip for ${String(m).padStart(2, '0')}/${y} has been generated.`, 'payroll', '/payslips');
      generated++;
    }
  });
  run();
  logAudit(req.user.id, 'run_payroll', 'payroll', null, { month: m, year: y, daysInMonth: dim, generated });
  res.json({ ok: true, generated });
});

// Indian-format number to words (e.g. 34160 -> "Thirty-Four Thousand One Hundred Sixty")
function numToWords(num) {
  num = Math.floor(Math.abs(Number(num) || 0));
  if (num === 0) return 'Zero';
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const two = (n) => n < 20 ? ones[n] : `${tens[Math.floor(n / 10)]}${n % 10 ? '-' + ones[n % 10] : ''}`;
  const three = (n) => `${n >= 100 ? ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' : '') : ''}${n % 100 ? two(n % 100) : ''}`;
  let words = '';
  const crore = Math.floor(num / 10000000); num %= 10000000;
  const lakh = Math.floor(num / 100000); num %= 100000;
  const thousand = Math.floor(num / 1000); num %= 1000;
  if (crore) words += three(crore) + ' Crore ';
  if (lakh) words += three(lakh) + ' Lakh ';
  if (thousand) words += three(thousand) + ' Thousand ';
  if (num) words += three(num);
  return words.trim();
}

// Build the full structured payslip for a payroll row (shared by the JSON + PDF endpoints).
function buildPayslip(payId) {
  const pay = db.prepare(`
    SELECT p.*, e.first_name, e.last_name, e.employee_code, e.designation, e.joining_date,
           e.bank_name, e.bank_account, e.ifsc, e.pan, e.pf_no, e.uan,
           d.name AS department_name
    FROM payroll p
    JOIN employees e ON e.id = p.employee_id
    LEFT JOIN departments d ON d.id = e.department_id
    WHERE p.id = ?
  `).get(payId);
  if (!pay) return null;

  const ytd = db.prepare(`
    SELECT COUNT(*) AS months,
           COALESCE(SUM(basic),0) AS basic, COALESCE(SUM(hra),0) AS hra,
           COALESCE(SUM(allowances),0) AS allowances, COALESCE(SUM(deductions),0) AS deductions
    FROM payroll WHERE employee_id = ? AND year = ? AND month <= ?
  `).get(pay.employee_id, pay.year, pay.month);

  const PT = pay.deductions >= 200 ? 200 : pay.deductions;
  const epf = Math.max(0, pay.deductions - PT);
  const ytdPT = PT * ytd.months;
  const ytdEpf = Math.max(0, ytd.deductions - ytdPT);
  const lopAmount = pay.lop_amount || 0;
  const lopDays = pay.lop_days || 0;
  const ytdLop = db.prepare('SELECT COALESCE(SUM(lop_amount),0) AS a FROM payroll WHERE employee_id = ? AND year = ? AND month <= ?')
    .get(pay.employee_id, pay.year, pay.month).a;

  const monthName = new Date(pay.year, pay.month - 1, 1).toLocaleString('en-US', { month: 'long' });
  const fmtDate = (d) => {
    if (!d) return '';
    const dt = new Date(d);
    if (isNaN(dt)) return d;
    return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`;
  };
  const payDate = new Date(pay.year, pay.month, 1);

  return {
    employeeId: pay.employee_id,
    month: pay.month, year: pay.year,
    company: {
      name: 'IGENIE LABS PRIVATE LIMITED',
      line1: 'D.No. 15/369-B, First Floor, Jogappagari Veedhi Madanapalle',
      line2: 'Andhra Pradesh 517325 India',
    },
    period: { monthName, year: pay.year, label: `${monthName} ${pay.year}`, payDate: fmtDate(payDate) },
    employee: {
      name: `${pay.first_name} ${pay.last_name}`.toUpperCase(),
      designation: pay.designation || '-',
      code: pay.employee_code,
      department: pay.department_name || '-',
      doj: fmtDate(pay.joining_date),
      pan: pay.pan || '', bank_account: pay.bank_account || '', pf_no: pay.pf_no || '', uan: pay.uan || '',
    },
    summary: {
      netPay: pay.net_pay,
      paidDays: pay.paid_days,
      lopDays: Math.max(0, (pay.working_days || 0) - (pay.paid_days || 0)),
    },
    earnings: [
      { label: 'Basic', amount: pay.basic, ytd: ytd.basic },
      { label: 'House Rent Allowance', amount: pay.hra, ytd: ytd.hra },
      { label: 'Special Allowance', amount: pay.allowances, ytd: ytd.allowances },
    ],
    deductions: [
      { label: 'EPF Contribution', amount: epf, ytd: ytdEpf },
      { label: 'Professional Tax', amount: PT, ytd: ytdPT },
      ...(lopAmount > 0 ? [{ label: `Loss of Pay (${lopDays} day${lopDays === 1 ? '' : 's'})`, amount: lopAmount, ytd: ytdLop }] : []),
    ],
    totals: {
      grossEarnings: pay.gross_pay,
      totalDeductions: pay.deductions + lopAmount,
      netPayable: pay.net_pay,
      amountInWords: `Indian Rupee ${numToWords(pay.net_pay)} Only`,
    },
  };
}

router.get('/:id/payslip-data', (req, res) => {
  const d = buildPayslip(req.params.id);
  if (!d) return res.status(404).json({ error: 'Not found' });
  if (req.user.role === 'employee' && d.employeeId !== req.user.employee.id) return res.status(403).json({ error: 'Forbidden' });
  res.json(d);
});

// Direct PDF download of the payslip (matches the on-screen layout).
router.get('/:id/payslip', (req, res) => {
  const d = buildPayslip(req.params.id);
  if (!d) return res.status(404).json({ error: 'Not found' });
  if (req.user.role === 'employee' && d.employeeId !== req.user.employee.id) return res.status(403).json({ error: 'Forbidden' });

  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="Payslip-${d.employee.code}-${d.period.monthName}-${d.year}.pdf"`);
  doc.pipe(res);

  // Use the bundled Unicode font so ₹ renders; fall back to Helvetica (Rs.) if the files are missing.
  // FSB = semibold (600), matching the on-screen slip's value weight.
  let FB = 'Helvetica', FSB = 'Helvetica-Bold', FBB = 'Helvetica-Bold', rupee = 'Rs. ';
  try {
    if (fs.existsSync(FONT_REG) && fs.existsSync(FONT_BOLD)) {
      doc.registerFont('Body', FONT_REG);
      doc.registerFont('Body-Bold', FONT_BOLD);
      if (fs.existsSync(FONT_SEMI)) { doc.registerFont('Body-Semi', FONT_SEMI); FSB = 'Body-Semi'; }
      else FSB = 'Body-Bold';
      FB = 'Body'; FBB = 'Body-Bold'; rupee = '₹';
    }
  } catch { /* keep Helvetica fallback */ }
  const money = (n) => rupee + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const amt = (n) => (!n ? '-' : money(n)); // dash for a zero monthly amount, matching the on-screen slip
  // Shrink a big amount's font size until it fits maxW on one line (so long salaries never overflow their box).
  const fitSize = (text, font, maxW, start) => {
    doc.font(font); let s = start;
    while (s > 9 && doc.fontSize(s).widthOfString(text) > maxW) s -= 0.5;
    return s;
  };

  const left = 40, right = 555, W = right - left;
  // Colours copied from payslip.css so the PDF matches the on-screen slip exactly.
  const mute = '#8a90a0', soft = '#6b7180', val = '#2b2f3a', ink = '#1f2430', line = '#e4e7ee', green = '#147a44';

  // Header
  try { if (fs.existsSync(LOGO_PATH)) doc.image(LOGO_PATH, left, 40, { height: 32 }); } catch { /* no logo */ }
  doc.fillColor(ink).font(FBB).fontSize(14).text(d.company.name, left + 76, 42);
  doc.fillColor(soft).font(FB).fontSize(8).text(d.company.line1, left + 76, 60).text(d.company.line2, left + 76, 71);
  doc.font(FB).fontSize(9).fillColor(soft).text('Payslip For the Month', right - 170, 44, { width: 170, align: 'right' });
  doc.font(FBB).fontSize(12).fillColor(ink).text(d.period.label, right - 170, 57, { width: 170, align: 'right' });
  doc.moveTo(left, 92).lineTo(right, 92).lineWidth(1).strokeColor(line).stroke();

  // Employee summary + net pay box
  doc.font(FBB).fontSize(9).fillColor('#3a3f4c').text('EMPLOYEE SUMMARY', left, 104);
  const sumRows = [['Employee Name', d.employee.name], ['Designation', d.employee.designation], ['Employee ID', d.employee.code],
    ['Department', d.employee.department], ['Date of Joining', d.employee.doj], ['Pay Period', d.period.label], ['Pay Date', d.period.payDate]];
  let sy = 124;
  for (const [k, v] of sumRows) {
    doc.font(FB).fontSize(9).fillColor(mute).text(k, left, sy, { width: 108 });
    doc.fillColor(mute).text(':', left + 110, sy);
    doc.font(FSB).fillColor(val).text(String(v || '-'), left + 120, sy, { width: 200 });
    sy += 16;
  }
  const boxX = right - 175, boxY = 122, boxW = 175;
  doc.roundedRect(boxX, boxY, boxW, 80, 4).fillAndStroke('#eafaf0', '#cde8d8');
  // Green left accent bar (border-left: 5px solid green on the web), clipped to the rounded left edge.
  doc.save().rect(boxX, boxY, 5, 80).clip();
  doc.roundedRect(boxX, boxY, boxW, 80, 4).fill('#2fae66');
  doc.restore();
  const npNet = money(d.summary.netPay);
  const npSize = fitSize(npNet, FBB, boxW - 28, 17);
  doc.fillColor('#1f2937').font(FBB).fontSize(npSize).text(npNet, boxX + 14, boxY + 15, { width: boxW - 28, lineBreak: false });
  doc.fillColor(soft).font(FB).fontSize(9).text('Total Net Pay', boxX + 14, boxY + 37);
  doc.moveTo(boxX + 14, boxY + 54).lineTo(boxX + boxW - 14, boxY + 54).dash(2, { space: 2 }).strokeColor('#bcd9c7').stroke().undash();
  doc.font(FB).fontSize(9).fillColor(soft).text('Paid Days', boxX + 14, boxY + 60).text('LOP Days', boxX + 14, boxY + 72);
  doc.fillColor(val).text(': ' + d.summary.paidDays, boxX + 90, boxY + 60).text(': ' + d.summary.lopDays, boxX + 90, boxY + 72);

  // ID block
  let iy = Math.max(sy, boxY + 80) + 12;
  doc.moveTo(left, iy).lineTo(right, iy).strokeColor(line).stroke();
  iy += 10;
  const idRow = (x, k, v) => {
    doc.font(FB).fontSize(9).fillColor(mute).text(k, x, iy, { width: 108 });
    doc.fillColor(mute).text(':', x + 110, iy);
    doc.font(FSB).fillColor(val).text(String(v || '—'), x + 120, iy, { width: 140 });
  };
  idRow(left, 'PF A/C Number', d.employee.pf_no); idRow(left + 270, 'UAN', d.employee.uan); iy += 16;
  idRow(left, 'Bank Account No', d.employee.bank_account); idRow(left + 270, 'PAN', d.employee.pan); iy += 26;

  // Earnings / Deductions
  const colGap = 15, colW = (W - colGap) / 2, eX = left, dX = left + colW + colGap, tableTop = iy;
  // Three columns per side: label · AMOUNT · YTD (matches the on-screen slip).
  const amtX = colW - 128, amtW = 58, ytdX = colW - 66, ytdW = 58, labW = colW - 138;
  const header = (x, title) => {
    doc.rect(x, tableTop, colW, 20).fill('#f7f9fd');
    doc.fillColor('#3a3f4c').font(FBB).fontSize(8).text(title.toUpperCase(), x + 10, tableTop + 6);
    doc.text('AMOUNT', x + amtX, tableTop + 6, { width: amtW, align: 'right' });
    doc.text('YTD', x + ytdX, tableTop + 6, { width: ytdW, align: 'right' });
  };
  header(eX, 'Earnings'); header(dX, 'Deductions');
  const rowH = 18;
  const drawRows = (x, items) => {
    let ry = tableTop + 20;
    for (const it of items) {
      doc.font(FB).fontSize(9).fillColor('#3a3f4c').text(it.label, x + 10, ry + 5, { width: labW });
      doc.fillColor(val).text(amt(it.amount), x + amtX, ry + 5, { width: amtW, align: 'right' });
      doc.fillColor(mute).text(money(it.ytd), x + ytdX, ry + 5, { width: ytdW, align: 'right' });
      ry += rowH;
    }
    return ry;
  };
  const rowsEnd = Math.max(drawRows(eX, d.earnings), drawRows(dX, d.deductions));
  const foot = (x, label, amount) => {
    doc.rect(x, rowsEnd, colW, 20).fill('#f6f7f9');
    doc.fillColor(val).font(FBB).fontSize(9).text(label, x + 10, rowsEnd + 6, { width: labW });
    doc.text(money(amount), x + amtX, rowsEnd + 6, { width: ytdX + ytdW - amtX, align: 'right' });
  };
  foot(eX, 'Gross Earnings', d.totals.grossEarnings); foot(dX, 'Total Deductions', d.totals.totalDeductions);
  doc.rect(eX, tableTop, colW, rowsEnd + 20 - tableTop).strokeColor(line).stroke();
  doc.rect(dX, tableTop, colW, rowsEnd + 20 - tableTop).strokeColor(line).stroke();

  // Net payable
  const npY = rowsEnd + 34;
  doc.rect(left, npY, W, 42).strokeColor(line).stroke();
  doc.fillColor(ink).font(FBB).fontSize(11).text('TOTAL NET PAYABLE', left + 14, npY + 10);
  doc.font(FB).fontSize(8).fillColor(mute).text('Gross Earnings - Total Deductions', left + 14, npY + 25);
  doc.rect(right - 150, npY, 150, 42).fill('#d8f6e3');
  const npFinal = money(d.totals.netPayable);
  const npFinalSize = fitSize(npFinal, FBB, 138, 15);
  doc.fillColor(green).font(FBB).fontSize(npFinalSize).text(npFinal, right - 150, npY + (42 - npFinalSize) / 2 - 1, { width: 150, align: 'center', lineBreak: false });

  doc.font(FB).fontSize(9).fillColor(soft).text('Amount In Words : ', left, npY + 56, { continued: true })
    .fillColor(val).font(FBB).text(d.totals.amountInWords);
  doc.font(FB).fontSize(8).fillColor('#aab0bd').text('This is a system-generated payslip and does not require a signature.', left, npY + 82, { width: W, align: 'center' });

  doc.end();
});

export default router;
