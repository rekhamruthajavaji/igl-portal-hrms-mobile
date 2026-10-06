import 'dotenv/config';
import bcrypt from 'bcryptjs';
import db from './db.js';
import { HOLIDAYS_2026 } from './data/holidays2026.js';
import { SALARIES_2026 } from './data/salaries2026.js';
import { BANK_DETAILS_2026 } from './data/bankDetails2026.js';

// Per-employee login password overrides (by email). Everyone else uses the default.
const PASSWORD_OVERRIDES = {
  'rehan.feroz@libraryone.com': 'RehanFeroz@04',
};

const hash = (p) => bcrypt.hashSync(p, 10);

console.log('Seeding HRMS database with iGenie Labs roster...');

db.exec(`
  DELETE FROM notifications; DELETE FROM feedback; DELETE FROM documents;
  DELETE FROM payroll; DELETE FROM attendance; DELETE FROM leaves; DELETE FROM leave_balances;
  DELETE FROM holidays; DELETE FROM leave_types;
  DELETE FROM offboarding_items; DELETE FROM offboardings; DELETE FROM tickets;
  DELETE FROM employees; DELETE FROM teams; DELETE FROM departments;
  DELETE FROM users; DELETE FROM audit_logs;
`);

// ── Departments ──
const deptIds = {};
for (const [name, desc] of [
  ['Operations', 'Company operations and leadership'],
  ['Engineering', 'Software development'],
  ['Data & Analytics', 'Data analysis and insights'],
  ['Cloud Infrastructure', 'Cloud administration and infrastructure'],
  ['Finance', 'Accounting and payroll'],
  ['IT', 'IT and workplace administration'],
  ['Security', 'Information security'],
]) {
  deptIds[name] = db.prepare('INSERT INTO departments (name, description) VALUES (?,?)').run(name, desc).lastInsertRowid;
}

// ── Leave types ──
const lt = (name, code, days, paid, gender) =>
  db.prepare('INSERT INTO leave_types (name, code, days_per_year, is_paid, gender_specific) VALUES (?,?,?,?,?)').run(name, code, days, paid, gender).lastInsertRowid;
const ltIds = {
  CL: lt('Casual Leave', 'CL', 12, 1, null),
  SL: lt('Sick Leave', 'SL', 10, 1, null),
  EL: lt('Earned Leave', 'EL', 15, 1, null),
  WFH: lt('Work From Home', 'WFH', 24, 1, null),
  ML: lt('Maternity Leave', 'ML', 180, 1, 'female'),
  PL: lt('Paternity Leave', 'PL', 10, 1, 'male'),
};

// ── Holidays 2026 (per location: AP, TS, DEL) ──
for (const [state, list] of Object.entries(HOLIDAYS_2026)) {
  for (const [name, date] of list) {
    db.prepare('INSERT INTO holidays (name, date, state) VALUES (?,?,?)').run(name, date, state);
  }
}

// ── Roster from EMPLOYEES_HRMS.xlsx ──  [name, designation, doj, phone]
const ROSTER = [
  ['PRANEEL KUMAR PERURU', 'Director - India Operations', '2026-01-01', '9391573093', 'praneel.peruru@libraryone.com'],
  ['SEETHAKA VYSHNAVI', 'Software Engineer', '2026-01-01', '9490431313', 'vyshnavi.seethaka@libraryone.com'],
  ['DANDE GEETHANJALI', 'Software Engineer', '2026-01-01', '9110347340', 'geethanjali.dande@libraryone.com'],
  null, // VIJAYA DURGA CHINTHA — no longer a current employee (slot kept so other IG-IND codes don't shift; IG-IND-0004 stays vacant)
  ['MANU KUMAR', 'Data Analyst', '2026-01-19', '9958218461', 'manu.kumar@libraryone.com'],
  ['PARAS KOLI', 'Data Analyst', '2026-01-19', '9911807966', 'paras.koli@libraryone.com'],
  ['RISHABH SRIVASTAVA', 'Data Analyst', '2026-01-19', '7376726451', 'rishabh.srivastava@libraryone.com'],
  ['MOHD ABU', 'Data Analyst', '2026-01-19', '8874340094', 'mohd.abu@libraryone.com'],
  ['MAST RAM', 'Principal Cloud Administrator', '2026-01-26', '9958289044', 'mast.ram@libraryone.com'],
  ['SANDESH PRABHAKAR MORE', 'Senior Manager - Cloud Administration', '2026-02-01', '9082578925', 'sandeshprabhakar.more@libraryone.com'],
  ['VENKATA JNANA PRASUNAMBA RAYAVARAPU', 'Financial Analyst', '2026-02-10', '8886077567', 'prasuna.rayavarapu@libraryone.com'],
  ['VIGNETHA ARCHANAPALLY', 'Software Engineer', '2026-02-23', '9281486660', 'vignetha.archanapally@libraryone.com'],
  ['MOHAMMAD REHAN FEROZ PANWALE', 'Software Engineer', '2026-06-04', '6305130862', 'rehan.feroz@libraryone.com', [16667, 8333, 5191, 2000]],
  ['P JAAGRUTHI', 'Software Engineer', '2026-03-04', '8919838557', 'jaagruthi.prabhakar@libraryone.com'],
  ['KAMAL KUMAR', 'Data Analyst (Information Coordinator)', '2026-03-09', '9717581503', 'kamal.kumar@libraryone.com'],
  ['SUPRIYA DABRAL', 'Data Analyst (Information Coordinator)', '2026-03-09', '7217856591', 'supriya.dabral@libraryone.com'],
  ['PREM SINGH', 'Microsoft 365 Admin / IT Admin', '2026-04-01', '9971161082', 'prem.singh@libraryone.com'],
  ['SUMANTH ADDANKI', 'Software Engineer (Trainee)', '2026-03-30', '7075810583', 'sumanth.addanki@libraryone.com'],
  ['MURALI KRISHNA SAI CHAITANYA MYLA', 'Associate Security Engineer', '2026-04-13', '8096224707', 'murali.myla@libraryone.com'],
  ['MAHESWARA SAI SUHAAS SANAPATHI', 'Software Engineer', '2026-05-01', '8790447915', 'suhaas.sanapathi@libraryone.com'],
  ['SAI MANOJ GUNTAMUKKALA', 'Associate Software Engineer', '2026-04-20', '9553697748', 'manoj.guntamukkala@libraryone.com'],
  ['BHAVANI SUBRAMANYAM', 'Software Engineer', '2026-05-01', '8464942862', 'bhavani.veluri@libraryone.com'],
  ['SAI PHANINDRA GANDAM', 'Associate Software Engineer', '2026-05-01', '8885351297', 'phanindra.gandham@libraryone.com'],
];

// designation -> department + salary tier [basic, hra, allowances, deductions]
const SAL = {
  director: [120000, 48000, 32000, 6000], senior_manager: [90000, 36000, 24000, 5000],
  principal: [85000, 34000, 21000, 5000], financial_analyst: [50000, 20000, 13000, 2500],
  it_admin: [48000, 19200, 12000, 2400], data_analyst: [42000, 16800, 11000, 2000],
  analyst_coord: [40000, 16000, 10000, 2000], swe: [45000, 18000, 12000, 2200],
  assoc_swe: [35000, 14000, 9000, 1800], trainee: [25000, 10000, 6000, 1200], security: [40000, 16000, 10000, 2000],
};
function classify(desig) {
  const d = desig.toLowerCase();
  if (d.includes('director')) return { dept: 'Operations', tier: 'director' };
  if (d.includes('senior manager')) return { dept: 'Cloud Infrastructure', tier: 'senior_manager' };
  if (d.includes('principal cloud')) return { dept: 'Cloud Infrastructure', tier: 'principal' };
  if (d.includes('financial')) return { dept: 'Finance', tier: 'financial_analyst' };
  if (d.includes('security')) return { dept: 'Security', tier: 'security' };
  if (d.includes('it admin') || d.includes('365')) return { dept: 'IT', tier: 'it_admin' };
  if (d.includes('data analyst')) return { dept: 'Data & Analytics', tier: d.includes('coordinator') ? 'analyst_coord' : 'data_analyst' };
  if (d.includes('trainee')) return { dept: 'Engineering', tier: 'trainee' };
  if (d.includes('associate software')) return { dept: 'Engineering', tier: 'assoc_swe' };
  return { dept: 'Engineering', tier: 'swe' };
}

const titleCase = (s) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
const usedEmails = new Set();

const created = []; // { empId, userId, role }
ROSTER.forEach((row, i) => {
  if (!row) return; // vacated slot (e.g. IG-IND-0004) — keeps later codes stable
  const [rawName, designation, doj, phone, emailOverride, salaryOverride] = row;
  const name = titleCase(rawName);
  const parts = name.split(/\s+/);
  const first = parts[0];
  const last = parts.length > 1 ? parts.slice(1).join(' ') : parts[0];

  const isBoss = i === 0;
  let email;
  if (emailOverride) {
    email = emailOverride.toLowerCase();
  } else if (isBoss) {
    email = 'praneel.peruru@libraryone.com';
  } else {
    let base = `${parts[0]}.${parts[parts.length - 1]}`.toLowerCase().replace(/[^a-z.]/g, '');
    let e = `${base}@igenielabs.com`, n = 1;
    while (usedEmails.has(e)) { e = `${base}${++n}@igenielabs.com`; }
    email = e;
  }
  usedEmails.add(email);

  const role = isBoss ? 'admin' : 'employee';
  const password = isBoss ? 'Admin@123' : (PASSWORD_OVERRIDES[email] || 'Igenie@2026');
  const { dept, tier } = classify(designation);
  const [basic, hra, allowances, deductions] = salaryOverride || SAL[tier];
  const code = `IG-IND-${String(i + 1).padStart(4, '0')}`;

  const userId = db.prepare('INSERT INTO users (email, password_hash, role) VALUES (?,?,?)')
    .run(email, hash(password), role).lastInsertRowid;
  const empId = db.prepare(`INSERT INTO employees
    (user_id, employee_code, first_name, last_name, phone, gender, state, joining_date, designation, department_id, basic_salary, hra, allowances, deductions)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    userId, code, first, last, phone, null, 'AP', doj, designation, deptIds[dept], basic, hra, allowances, deductions
  ).lastInsertRowid;

  created.push({ empId, userId, role, dept, first, last });
});

const boss = created[0];

// Everyone reports to the Director.
db.prepare('UPDATE employees SET manager_id = ? WHERE id != ?').run(boss.empId, boss.empId);

// Real salary breakups (from Employee Salary Breakups.xlsx) override the tier defaults.
for (const [code, s] of Object.entries(SALARIES_2026)) {
  db.prepare('UPDATE employees SET basic_salary = ?, hra = ?, allowances = ?, deductions = ? WHERE employee_code = ?')
    .run(s.basic, s.hra, s.allowances, s.deductions, code);
}

// Bank & tax details. The committed module holds only PLACEHOLDER data; the REAL values are
// injected on the server from the secret BANK_DETAILS_JSON env var, so no real PII is in source.
let BANK_DETAILS = BANK_DETAILS_2026;
if (process.env.BANK_DETAILS_JSON) {
  try { BANK_DETAILS = JSON.parse(process.env.BANK_DETAILS_JSON); }
  catch { console.warn('BANK_DETAILS_JSON is not valid JSON — falling back to placeholder bank data.'); }
}
for (const c of created) {
  const u = db.prepare('SELECT email FROM users WHERE id = ?').get(c.userId);
  const b = u && BANK_DETAILS[u.email];
  if (b) {
    db.prepare('UPDATE employees SET bank_name = ?, bank_account = ?, ifsc = ?, pan = ? WHERE id = ?')
      .run(b.bank_name, b.bank_account, b.ifsc, b.pan, c.empId);
  }
}

// ── Teams: one per department, led by the Director ──
const teamByDept = {};
for (const dname of Object.keys(deptIds)) {
  teamByDept[dname] = db.prepare('INSERT INTO teams (name, department_id, manager_id) VALUES (?,?,?)')
    .run(`${dname} Team`, deptIds[dname], boss.empId).lastInsertRowid;
}
for (const c of created) {
  db.prepare('UPDATE employees SET team_id = ? WHERE id = ?').run(teamByDept[c.dept], c.empId);
}

// ── Leave balances for the current year (prorated for mid-year joiners; skip gender-specific when gender unknown) ──
const currentYear = new Date().getFullYear();
const types = db.prepare('SELECT * FROM leave_types').all();
const allEmps = db.prepare('SELECT * FROM employees').all();
for (const e of allEmps) {
  const joinedThisYear = new Date(e.joining_date).getFullYear() === currentYear;
  const monthsRemaining = joinedThisYear ? Math.max(1, 12 - new Date(e.joining_date).getMonth()) : 12;
  for (const t of types) {
    if (t.gender_specific && (!e.gender || t.gender_specific.toLowerCase() !== e.gender.toLowerCase())) continue;
    const total = Math.round((t.days_per_year * monthsRemaining / 12) * 10) / 10;
    db.prepare('INSERT OR IGNORE INTO leave_balances (employee_id, leave_type_id, year, total, used) VALUES (?,?,?,?,0)').run(e.id, t.id, currentYear, total);
  }
}

// ── A little live activity: two pending leave requests to the Director ──
const someEmps = created.slice(1); // exclude boss
if (someEmps.length >= 2) {
  db.prepare("INSERT INTO leaves (employee_id, leave_type_id, start_date, end_date, days, reason, status) VALUES (?,?,?,?,?,?, 'pending')")
    .run(someEmps[0].empId, ltIds.CL, '2026-08-18', '2026-08-19', 2, 'Family function');
  db.prepare("INSERT INTO leaves (employee_id, leave_type_id, start_date, end_date, days, reason, status) VALUES (?,?,?,?,?,?, 'pending')")
    .run(someEmps[1].empId, ltIds.SL, '2026-08-14', '2026-08-14', 1, 'Not feeling well');
  db.prepare("INSERT INTO notifications (user_id, title, message, type, link) VALUES (?,?,?,?,?)")
    .run(boss.userId, 'New leave request', `${someEmps[0].first} ${someEmps[0].last} requested 2 day(s) of Casual Leave`, 'leave', '/leaves');
}

// ── Attendance for the past ~20 working days ──
const today = new Date();
for (const e of allEmps) {
  for (let i = 1; i <= 20; i++) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    if (d.getDay() === 0 || d.getDay() === 6) continue;
    if (new Date(e.joining_date) > d) continue; // not yet joined
    const dateStr = d.toISOString().slice(0, 10);
    const inT = new Date(d); inT.setHours(9, Math.floor(Math.random() * 30), 0);
    const outT = new Date(d); outT.setHours(18, Math.floor(Math.random() * 40), 0);
    const hours = Math.round(((outT - inT) / 36e5) * 100) / 100;
    db.prepare('INSERT OR IGNORE INTO attendance (employee_id, date, check_in, check_out, working_hours, status) VALUES (?,?,?,?,?, ?)')
      .run(e.id, dateStr, inT.toISOString(), outT.toISOString(), hours, 'present');
  }
}

// ── Payroll for last month + welcome/payslip notifications ──
const lastMonth = new Date(); lastMonth.setMonth(lastMonth.getMonth() - 1);
const pMonth = lastMonth.getMonth() + 1, pYear = lastMonth.getFullYear();
for (const e of allEmps) {
  const gross = e.basic_salary + e.hra + e.allowances;
  const net = gross - e.deductions;
  db.prepare(`INSERT OR REPLACE INTO payroll (employee_id, month, year, basic, hra, allowances, deductions, gross_pay, net_pay, working_days, paid_days)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(e.id, pMonth, pYear, e.basic_salary, e.hra, e.allowances, e.deductions, gross, net, 22, 22);
  db.prepare("INSERT INTO notifications (user_id, title, message, type, link) VALUES (?,?,?,?,?)")
    .run(e.user_id, 'Welcome to iGenie Labs HRMS', 'Your portal is ready — explore your dashboard, leaves and payslips.', 'info', '/');
  db.prepare("INSERT INTO notifications (user_id, title, message, type, link) VALUES (?,?,?,?,?)")
    .run(e.user_id, 'Payslip available', `Your payslip for ${String(pMonth).padStart(2, '0')}/${pYear} is ready.`, 'payroll', '/payslips');
}

console.log(`Seed complete — ${created.length} employees loaded.\n`);
console.log('  Admin (Director) : praneel.peruru@libraryone.com / Admin@123   (Praneel Kumar Peruru)');
console.log('  Employees        : <name>@libraryone.com / Igenie@2026');
console.log('    e.g. rehan.feroz@libraryone.com, mohd.abu@libraryone.com, prem.singh@libraryone.com');
