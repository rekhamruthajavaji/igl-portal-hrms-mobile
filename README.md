# iGenie Labs HRMS Portal

A full-stack Human Resource Management System built with **React + Node.js/Express + SQLite + JWT**. Includes employee management, leave workflows, attendance, payroll with PDF payslips, holidays, performance feedback, notifications, documents, and reports — with role-based access for Admin (HR), Manager, and Employee.

![Corporate Blue UI · Professional · Production-ready]

---

## Quick Start

You need **Node.js 18+** installed. SQLite is bundled, no external DB needed.

### 1. Install dependencies

```powershell
# In server folder
cd server
npm install

# In client folder (new terminal)
cd client
npm install
```

### 2. Seed the database

```powershell
cd server
npm run seed
```

This creates the SQLite DB at `server/data/hrms.db` with demo accounts, departments, leave types, holidays for 2026, attendance history, and one month of payroll.

### 3. Start both apps

**Terminal 1 — API server:**
```powershell
cd server
npm run dev
```
Runs on **http://localhost:4000**

**Terminal 2 — React client:**
```powershell
cd client
npm run dev
```
Runs on **http://localhost:5173** (opens in browser)

---

## Demo Accounts

Click any account on the login screen to autofill credentials:

| Role | Email | Password |
|---|---|---|
| **Admin (HR)** | `admin@igenielabs.com` | `Admin@123` |
| **Manager** (Engineering) | `manager@igenielabs.com` | `Manager@123` |
| **Manager** (Sales) | `sales.manager@igenielabs.com` | `Manager@123` |
| **Employee** | `employee@igenielabs.com` | `Employee@123` |
| **Employee** | `meera@igenielabs.com` | `Employee@123` |
| **Employee** | `arjun@igenielabs.com` | `Employee@123` |
| **Employee** | `ananya@igenielabs.com` | `Employee@123` |

---

## Features

### Employee Management
- Full CRUD with employee profile, department, team, manager, bank details, compensation
- Role assignment (Admin / Manager / Employee)
- Employee directory with search

### Leave Management
- Six leave types: Casual, Sick, Earned, WFH, Maternity, Paternity
- **Prorata calculation** based on joining date
- **Gender-specific leaves** (Maternity for female, Paternity for male)
- Approval workflow (Manager approves their team; Admin can approve anyone)
- Real-time balance tracking; auto-deducts on approval, restores on cancel

### Attendance
- One-click check-in / check-out with live clock
- Auto-calculated working hours
- Monthly summary per employee

### Payroll & Payslips
- One-click monthly payroll generation
- Salary breakdown: Basic, HRA, Allowances, Deductions, Gross, Net
- Adjusts paid days from attendance + approved leaves
- **Downloadable PDF payslips** (generated server-side with pdfkit)

### Holiday Management
- **State-based calendar** — employees only see holidays for their work state + national
- Filterable by year / state

### Performance Feedback
- Periodic reviews with strengths, improvements, goals
- 1-5 star rating scale
- Manager-to-team-member workflow

### Notifications
- In-app bell with unread count
- Auto-triggered on leave events, payroll, password reset
- Admin broadcast to all users

### Documents
- Upload personal documents (ID proof, offer letter, certificates)
- Per-employee storage; admin can view all
- Download / delete

### Reports & Analytics
- Attendance summary (days present, total hours, average hours)
- Leave summary (entitlement, used, remaining)
- Audit logs (admin-only)
- **CSV export** for any report

### Security
- JWT authentication (7-day expiry)
- bcrypt password hashing
- Role-based access control on every route
- Audit log for sensitive actions
- Self-service password change

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, React Router, Vite, Axios |
| Backend | Node.js, Express |
| Database | SQLite (better-sqlite3) — easy switch to PostgreSQL |
| Auth | JWT + bcrypt |
| PDF | pdfkit |
| File Upload | multer |

---

## Project Structure

```
HRMS/
├── server/
│   ├── src/
│   │   ├── index.js          # Express entry
│   │   ├── db.js              # SQLite schema + helpers
│   │   ├── seed.js            # Demo data
│   │   ├── middleware/
│   │   │   └── auth.js        # JWT + RBAC
│   │   └── routes/
│   │       ├── auth.js
│   │       ├── employees.js
│   │       ├── departments.js  # /api/org/*
│   │       ├── leaves.js
│   │       ├── holidays.js
│   │       ├── attendance.js
│   │       ├── payroll.js
│   │       ├── feedback.js
│   │       ├── notifications.js
│   │       ├── documents.js
│   │       └── reports.js
│   ├── data/                  # SQLite DB + uploaded files (gitignored)
│   ├── .env                   # JWT secret, ports
│   └── package.json
└── client/
    ├── src/
    │   ├── main.jsx
    │   ├── App.jsx
    │   ├── api.js              # Axios with auth interceptor
    │   ├── context/AuthContext.jsx
    │   ├── components/Layout.jsx
    │   ├── pages/              # All module pages
    │   └── styles/global.css   # Corporate Blue theme
    ├── vite.config.js          # Proxies /api to :4000
    └── package.json
```

---

## API Reference

All routes prefixed with `/api`. Send `Authorization: Bearer <token>` after login.

| Module | Endpoints |
|---|---|
| Auth | `POST /auth/login`, `GET /auth/me`, `POST /auth/change-password` |
| Employees | `GET/POST/PUT/DELETE /employees`, `POST /employees/:id/reset-password` |
| Org | `GET/POST/PUT/DELETE /org/departments`, `/org/teams` |
| Leaves | `GET /leaves`, `POST /leaves`, `POST /leaves/:id/{approve,reject,cancel}`, `GET /leaves/types`, `GET /leaves/balances` |
| Attendance | `POST /attendance/check-in`, `POST /attendance/check-out`, `GET /attendance`, `GET /attendance/today`, `GET /attendance/summary` |
| Payroll | `GET /payroll`, `POST /payroll/generate`, `GET /payroll/:id/payslip` (PDF) |
| Holidays | `GET/POST/PUT/DELETE /holidays` |
| Feedback | `GET/POST/DELETE /feedback` |
| Notifications | `GET /notifications`, `POST /notifications/:id/read`, `POST /notifications/read-all`, `POST /notifications/broadcast` |
| Documents | `GET /documents`, `POST /documents/upload`, `GET /documents/:id/download`, `DELETE /documents/:id` |
| Reports | `GET /reports/dashboard`, `/reports/attendance-summary`, `/reports/leave-summary`, `/reports/audit-logs` |

---

## Resetting the Database

To wipe and re-seed:

```powershell
cd server
Remove-Item data\hrms.db -Force
npm run seed
```

---

## Production Notes

Before deploying to production:

1. **Change `JWT_SECRET`** in `server/.env` to a strong random value.
2. **Switch to PostgreSQL** — replace `better-sqlite3` with `pg` and update queries (mostly compatible).
3. **Enable HTTPS** — terminate TLS at a reverse proxy (nginx / Caddy / cloud load balancer).
4. **Build the client**: `cd client && npm run build` → serve `dist/` from a CDN or Express static handler.
5. **Set `CLIENT_URL`** in `.env` to your production origin for stricter CORS.
6. **Rotate the default seed passwords** before any non-demo use.

---

Built for iGenie Labs · © 2026
