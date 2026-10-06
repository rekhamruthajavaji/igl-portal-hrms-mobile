import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, AreaChart, Area
} from 'recharts';
import api from '../api';
import { useAuth } from '../context/AuthContext';

const COLORS = ['#4f46e5', '#06b6d4', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6', '#ec4899', '#0ea5e9'];

export default function Reports() {
  const { user } = useAuth();
  const [tab, setTab] = useState('attendance');
  const [att, setAtt] = useState([]);
  const [lv, setLv] = useState([]);
  const [audit, setAudit] = useState([]);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());

  useEffect(() => {
    api.get(`/reports/attendance-summary?month=${month}&year=${year}`).then(r => setAtt(r.data));
    api.get(`/reports/leave-summary?year=${year}`).then(r => setLv(r.data));
    if (user.role === 'admin') api.get('/reports/audit-logs').then(r => setAudit(r.data));
  }, [month, year]);

  const exportCSV = (data, name) => {
    if (data.length === 0) return;
    const keys = Object.keys(data[0]);
    const csv = [keys.join(','), ...data.map(r => keys.map(k => `"${(r[k] ?? '').toString().replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // === Derived analytics ===
  const attMetrics = useMemo(() => {
    if (!att.length) return null;
    const totalPresent = att.reduce((s, r) => s + r.days_present, 0);
    const totalHours = att.reduce((s, r) => s + (r.total_hours || 0), 0);
    const avgHours = att.length ? totalHours / att.length : 0;
    const topPerformer = [...att].sort((a, b) => b.total_hours - a.total_hours)[0];
    return { totalPresent, totalHours, avgHours, topPerformer };
  }, [att]);

  const leaveByType = useMemo(() => {
    const map = {};
    lv.forEach(r => {
      map[r.leave_type] = (map[r.leave_type] || 0) + (r.used || 0);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value: Math.round(value * 10) / 10 }));
  }, [lv]);

  const leaveByEmployee = useMemo(() => {
    const map = {};
    lv.forEach(r => {
      if (!map[r.name]) map[r.name] = { name: r.name, total: 0, used: 0 };
      map[r.name].total += r.total || 0;
      map[r.name].used += r.used || 0;
    });
    return Object.values(map).map(r => ({ name: r.name.split(' ')[0], total: r.total, used: Math.round(r.used * 10) / 10, remaining: Math.round((r.total - r.used) * 10) / 10 }));
  }, [lv]);

  const monthName = new Date(2000, month - 1, 1).toLocaleString('en', { month: 'long' });

  return (
    <>
      <div className="page-hero hero-reports">
        <div>
          <h2>Reports & Analytics</h2>
          <p>Visual insights into attendance, leaves, and audit trails — exportable to CSV.</p>
        </div>
        <button className="btn btn-primary" onClick={() => exportCSV(tab === 'attendance' ? att : tab === 'leave' ? lv : audit, `${tab}-${year}`)}>
          Export {tab.charAt(0).toUpperCase() + tab.slice(1)} CSV
        </button>
      </div>

      <div className="toolbar" style={{ justifyContent: 'space-between' }}>
        <div className="tab-pills">
          <button className={tab === 'attendance' ? 'active' : ''} onClick={() => setTab('attendance')}>Attendance</button>
          <button className={tab === 'leave' ? 'active' : ''} onClick={() => setTab('leave')}>Leaves</button>
          {user.role === 'admin' && <button className={tab === 'audit' ? 'active' : ''} onClick={() => setTab('audit')}>Audit Logs</button>}
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {tab === 'attendance' && (
            <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
              {Array.from({ length: 12 }, (_, i) => <option key={i+1} value={i+1}>{new Date(2000, i, 1).toLocaleString('en', { month: 'long' })}</option>)}
            </select>
          )}
          <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {[year-1, year, year+1].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {tab === 'attendance' && (
        <>
          {attMetrics && (
            <div className="metric-grid">
              <div className="metric-card indigo">
                <div className="metric-label">Days Logged ({monthName})</div>
                <div className="metric-value">{attMetrics.totalPresent}</div>
                <div className="metric-sub">Across all employees</div>
              </div>
              <div className="metric-card success">
                <div className="metric-label">Total Hours</div>
                <div className="metric-value">{Math.round(attMetrics.totalHours)}h</div>
                <div className="metric-sub">Org-wide working hours</div>
              </div>
              <div className="metric-card cyan">
                <div className="metric-label">Avg Hours / Employee</div>
                <div className="metric-value">{attMetrics.avgHours.toFixed(1)}h</div>
                <div className="metric-sub">Average across team</div>
              </div>
              <div className="metric-card pink">
                <div className="metric-label">Top Contributor</div>
                <div className="metric-value" style={{ fontSize: 22 }}>{attMetrics.topPerformer?.name || '-'}</div>
                <div className="metric-sub">{Math.round(attMetrics.topPerformer?.total_hours || 0)}h logged</div>
              </div>
            </div>
          )}

          <div className="grid-2">
            <div className="chart-card">
              <h3>Days Present by Employee — {monthName} {year}</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={att.map(r => ({ name: r.name.split(' ')[0], days: r.days_present }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" stroke="#64748b" style={{ fontSize: 12 }} />
                  <YAxis stroke="#64748b" style={{ fontSize: 12 }} />
                  <Tooltip contentStyle={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 8 }} />
                  <Bar dataKey="days" radius={[8, 8, 0, 0]}>
                    {att.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="chart-card">
              <h3>Total Hours by Employee</h3>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={att.map(r => ({ name: r.name.split(' ')[0], hours: Math.round(r.total_hours || 0) }))}>
                  <defs>
                    <linearGradient id="hoursGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.7} />
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" stroke="#64748b" style={{ fontSize: 12 }} />
                  <YAxis stroke="#64748b" style={{ fontSize: 12 }} />
                  <Tooltip contentStyle={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 8 }} />
                  <Area type="monotone" dataKey="hours" stroke="#06b6d4" strokeWidth={2} fill="url(#hoursGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card" style={{ marginTop: 20 }}>
            <div className="card-header"><h3>Detailed Attendance</h3></div>
            <table className="table">
              <thead><tr><th>Code</th><th>Name</th><th>Days Present</th><th>Total Hours</th><th>Avg Hours/Day</th></tr></thead>
              <tbody>
                {att.length === 0 && <tr><td colSpan="5" className="empty">No data</td></tr>}
                {att.map(r => (
                  <tr key={r.id}>
                    <td><span className="badge badge-info">{r.employee_code}</span></td>
                    <td><strong>{r.name}</strong></td>
                    <td>{r.days_present}</td>
                    <td>{Math.round(r.total_hours || 0)}h</td>
                    <td>{r.avg_hours}h</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'leave' && (
        <>
          <div className="grid-2">
            <div className="chart-card">
              <h3>Leave Days Used by Type — {year}</h3>
              <ResponsiveContainer width="100%" height={320}>
                <PieChart>
                  <Pie data={leaveByType} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={110} innerRadius={60} paddingAngle={3}>
                    {leaveByType.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 8 }} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="chart-card">
              <h3>Leave Utilization by Employee</h3>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={leaveByEmployee} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" stroke="#64748b" style={{ fontSize: 12 }} />
                  <YAxis type="category" dataKey="name" stroke="#64748b" style={{ fontSize: 12 }} width={80} />
                  <Tooltip contentStyle={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 8 }} />
                  <Legend />
                  <Bar dataKey="used" stackId="a" fill="#f43f5e" name="Used" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="remaining" stackId="a" fill="#10b981" name="Remaining" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card" style={{ marginTop: 20 }}>
            <div className="card-header"><h3>Leave Balances Detail</h3></div>
            <table className="table">
              <thead><tr><th>Code</th><th>Name</th><th>Leave Type</th><th>Total</th><th>Used</th><th>Remaining</th></tr></thead>
              <tbody>
                {lv.length === 0 && <tr><td colSpan="6" className="empty">No data</td></tr>}
                {lv.map((r, i) => (
                  <tr key={i}>
                    <td><span className="badge badge-info">{r.employee_code}</span></td>
                    <td><strong>{r.name}</strong></td>
                    <td>{r.leave_type}</td>
                    <td>{r.total}</td>
                    <td><span className="badge badge-warning">{r.used}</span></td>
                    <td><span className="badge badge-success">{r.remaining}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'audit' && (
        <div className="card">
          <div className="card-header"><h3>System Audit Trail</h3><span style={{ fontSize: 12, color: 'var(--text-soft)' }}>Last 200 events</span></div>
          <table className="table">
            <thead><tr><th>Time</th><th>User</th><th>Action</th><th>Entity</th><th>Details</th></tr></thead>
            <tbody>
              {audit.length === 0 && <tr><td colSpan="5" className="empty">No logs</td></tr>}
              {audit.map(r => (
                <tr key={r.id}>
                  <td style={{ fontSize: 12 }}>{new Date(r.created_at).toLocaleString()}</td>
                  <td>{r.email || '-'}</td>
                  <td><span className="badge badge-purple">{r.action}</span></td>
                  <td>{r.entity || '-'}{r.entity_id ? ` #${r.entity_id}` : ''}</td>
                  <td style={{ fontSize: 11, color: 'var(--text-soft)', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.details || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
