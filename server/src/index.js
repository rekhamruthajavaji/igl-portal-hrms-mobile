import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import db from './db.js';
import authRouter from './routes/auth.js';
import employeesRouter from './routes/employees.js';
import probationLettersRouter from './routes/probationLetters.js';
import orgRouter from './routes/departments.js';
import leavesRouter from './routes/leaves.js';
import holidaysRouter from './routes/holidays.js';
import attendanceRouter from './routes/attendance.js';
import payrollRouter from './routes/payroll.js';
import feedbackRouter from './routes/feedback.js';
import notificationsRouter from './routes/notifications.js';
import documentsRouter from './routes/documents.js';
import reportsRouter from './routes/reports.js';
import managerRouter from './routes/manager.js';
import offboardingRouter from './routes/offboarding.js';
import ticketsRouter from './routes/tickets.js';
import accessRouter from './routes/access.js';

// === CORS: accept localhost dev URLs + any *.vercel.app deployments + the configured CLIENT_URL ===
const allowList = (process.env.CLIENT_URL || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const corsOptions = {
  origin: (origin, cb) => {
    // Allow same-origin / curl / Postman (no Origin header)
    if (!origin) return cb(null, true);
    if (allowList.includes(origin)) return cb(null, true);
    if (/^https?:\/\/localhost(:\d+)?$/.test(origin)) return cb(null, true);
    if (/\.vercel\.app$/.test(new URL(origin).hostname)) return cb(null, true);
    // Single-service deploy: frontend + backend share the same Render origin.
    if (/\.onrender\.com$/.test(new URL(origin).hostname)) return cb(null, true);
    return cb(new Error(`Origin ${origin} not allowed by CORS`));
  },
  credentials: true,
};

// === Auto-seed if the DB is empty (handles Render free-tier cold starts wiping the disk) ===
const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
if (userCount === 0) {
  console.log('Empty database detected — running seed...');
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const result = spawnSync(process.execPath, [path.join(__dirname, 'seed.js')], { stdio: 'inherit' });
  if (result.status !== 0) console.error('Seed exited with code', result.status);
}

const app = express();
app.use(cors(corsOptions));
app.use(express.json({ limit: '5mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'IGL Portal API' }));

const __dirnameApp = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.join(__dirnameApp, '..', '..', 'client', 'dist');

app.use('/api/auth', authRouter);
app.use('/api/employees', employeesRouter);
app.use('/api/probation-letters', probationLettersRouter);
app.use('/api/org', orgRouter);
app.use('/api/leaves', leavesRouter);
app.use('/api/holidays', holidaysRouter);
app.use('/api/attendance', attendanceRouter);
app.use('/api/payroll', payrollRouter);
app.use('/api/feedback', feedbackRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/documents', documentsRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/manager', managerRouter);
app.use('/api/offboarding', offboardingRouter);
app.use('/api/tickets', ticketsRouter);
app.use('/api/access', accessRouter);

// === Serve the built React frontend (single-service deploy) ===
// In production we build client/dist and serve it from this same server,
// so the whole app lives behind ONE URL. The client uses same-origin /api.
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  // SPA fallback: any non-API GET returns index.html so React Router handles it.
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.use((err, _req, res, _next) => {
  console.error('API error:', err);
  res.status(err.status || 500).json({ error: err.message || 'Server error' });
});

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`\n  IGL Portal API running on http://localhost:${port}\n`);
});
