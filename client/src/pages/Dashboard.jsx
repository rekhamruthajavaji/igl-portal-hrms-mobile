import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/reports/dashboard').then(r => setData(r.data)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loader" />;
  if (!data) return null;

  const isEmp = user.role === 'employee';

  return (
    <>
      <div className="page-hero hero-dashboard">
        <div>
          <h2>Welcome back, {user.employee?.first_name || 'there'} 👋</h2>
          <p>{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} — Here is what's happening across your organization.</p>
        </div>
      </div>

      {isEmp ? <EmployeeDashboard data={data} /> : <AdminDashboard data={data} />}
    </>
  );
}

const I = {
  users: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2 M9 11a4 4 0 100-8 4 4 0 000 8z M23 21v-2a4 4 0 00-3-3.87 M16 3.13a4 4 0 010 7.75" /></svg>,
  check: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>,
  calendar: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>,
  clock: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>,
  doc: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6" /></svg>,
};

function AdminDashboard({ data }) {
  return (
    <>
      <div className="metric-grid">
        <div className="metric-card indigo">
          <div className="metric-icon">{I.users}</div>
          <div className="metric-label">Total Employees</div>
          <div className="metric-value">{data.total_employees}</div>
          <div className="metric-sub">Active workforce</div>
        </div>
        <div className="metric-card success">
          <div className="metric-icon">{I.check}</div>
          <div className="metric-label">Present Today</div>
          <div className="metric-value">{data.present_today}</div>
          <div className="metric-sub">Checked in</div>
        </div>
        <div className="metric-card warning">
          <div className="metric-icon">{I.calendar}</div>
          <div className="metric-label">On Leave Today</div>
          <div className="metric-value">{data.on_leave_today}</div>
          <div className="metric-sub">Approved absences</div>
        </div>
        <div className="metric-card pink">
          <div className="metric-icon">{I.clock}</div>
          <div className="metric-label">Pending Approvals</div>
          <div className="metric-value">{data.pending_leaves}</div>
          <div className="metric-sub">Across all teams</div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header"><h3>Recent Leave Requests</h3><Link to="/leaves" className="btn btn-sm btn-secondary">View all</Link></div>
          <div className="card-body" style={{ padding: 0 }}>
            {data.recent_leaves?.length === 0 && <div className="empty">No recent requests</div>}
            <table className="table">
              <tbody>
                {data.recent_leaves?.map(l => (
                  <tr key={l.id}>
                    <td><strong>{l.employee_name}</strong><div style={{ fontSize: 12, color: 'var(--text-soft)' }}>{l.leave_type_name} · {l.days}d</div></td>
                    <td style={{ fontSize: 12 }}>{l.start_date} → {l.end_date}</td>
                    <td><span className={`badge badge-${l.status === 'pending' ? 'warning' : l.status === 'approved' ? 'success' : 'danger'}`}>{l.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h3>Upcoming Holidays</h3><Link to="/holidays" className="btn btn-sm btn-secondary">View calendar</Link></div>
          <div className="card-body">
            {data.upcoming_holidays?.length === 0 && <div className="empty">No upcoming holidays</div>}
            {data.upcoming_holidays?.map(h => {
              const d = new Date(h.date);
              return (
                <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                  <div className="holiday-date" style={{ width: 50, padding: '6px 0' }}>
                    <div className="day">{d.getDate()}</div>
                    <div className="month">{d.toLocaleString('en', { month: 'short' })}</div>
                  </div>
                  <div>
                    <div style={{ fontWeight: 500 }}>{h.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-soft)' }}>{h.state === 'ALL' ? 'National' : `State: ${h.state}`}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-header"><h3>Headcount by Department</h3></div>
        <div className="card-body">
          {data.departments.map(d => (
            <div key={d.name} className="balance-row">
              <div className="balance-head">
                <strong>{d.name}</strong>
                <span>{d.count} employee{d.count !== 1 ? 's' : ''}</span>
              </div>
              <div className="balance-bar">
                <div className="balance-bar-fill" style={{ width: `${Math.min(100, (d.count / Math.max(1, data.total_employees)) * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function EmployeeDashboard({ data }) {
  return (
    <>
      <div className="metric-grid">
        <div className="metric-card indigo">
          <div className="metric-icon">{I.calendar}</div>
          <div className="metric-label">Leave Balance</div>
          <div className="metric-value">{data.balances.reduce((s, b) => s + (b.total - b.used), 0).toFixed(1)}</div>
          <div className="metric-sub">Days remaining this year</div>
        </div>
        <div className="metric-card warning">
          <div className="metric-icon">{I.clock}</div>
          <div className="metric-label">Pending Requests</div>
          <div className="metric-value">{data.pending_leaves}</div>
          <div className="metric-sub">Awaiting approval</div>
        </div>
        <div className="metric-card success">
          <div className="metric-icon">{I.doc}</div>
          <div className="metric-label">Recent Payslips</div>
          <div className="metric-value">{data.recent_payslips?.length || 0}</div>
          <div className="metric-sub">Generated this year</div>
        </div>
        <div className="metric-card cyan">
          <div className="metric-icon">{I.calendar}</div>
          <div className="metric-label">Upcoming Holidays</div>
          <div className="metric-value">{data.upcoming_holidays?.length || 0}</div>
          <div className="metric-sub">In your state</div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header"><h3>Leave Balances</h3><Link to="/leaves" className="btn btn-sm btn-secondary">Apply</Link></div>
          <div className="card-body">
            {data.balances.map(b => {
              const remaining = b.total - b.used;
              const pct = b.total > 0 ? (b.used / b.total) * 100 : 0;
              return (
                <div key={b.name} className="balance-row">
                  <div className="balance-head">
                    <strong>{b.name}</strong>
                    <span><b style={{ color: 'var(--navy)' }}>{remaining.toFixed(1)}</b> / {b.total} days</span>
                  </div>
                  <div className="balance-bar">
                    <div className="balance-bar-fill" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h3>Upcoming Holidays</h3><Link to="/holidays" className="btn btn-sm btn-secondary">View all</Link></div>
          <div className="card-body">
            {data.upcoming_holidays?.length === 0 && <div className="empty">No upcoming holidays</div>}
            {data.upcoming_holidays?.map(h => {
              const d = new Date(h.date);
              return (
                <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                  <div className="holiday-date" style={{ width: 50, padding: '6px 0' }}>
                    <div className="day">{d.getDate()}</div>
                    <div className="month">{d.toLocaleString('en', { month: 'short' })}</div>
                  </div>
                  <div>
                    <div style={{ fontWeight: 500 }}>{h.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-soft)' }}>{h.state === 'ALL' ? 'National' : `State: ${h.state}`}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
