import React, { useEffect, useState } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';

export default function Attendance() {
  const { user } = useAuth();
  const [today, setToday] = useState(null);
  const [history, setHistory] = useState([]);
  const [summary, setSummary] = useState(null);
  const [now, setNow] = useState(new Date());

  const load = () => {
    if (user.role === 'employee') {
      api.get('/attendance/today').then(r => setToday(r.data));
      api.get('/attendance/summary').then(r => setSummary(r.data));
    }
    api.get('/attendance').then(r => setHistory(r.data));
  };

  useEffect(() => {
    load();
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const checkIn = async () => { await api.post('/attendance/check-in'); load(); };
  const checkOut = async () => { await api.post('/attendance/check-out'); load(); };

  const fmt = (iso) => iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-';

  return (
    <>
      <div className="page-hero hero-attendance">
        <div><h2>Attendance</h2><p>Track check-in, check-out, and working hours in real time.</p></div>
      </div>

      {user.role === 'employee' && (
        <div className="grid-2" style={{ marginBottom: 20 }}>
          <div className="card">
            <div className="card-body" style={{ textAlign: 'center', padding: 30 }}>
              <div style={{ fontSize: 14, color: 'var(--text-soft)' }}>Today</div>
              <div style={{ fontSize: 36, fontWeight: 700, color: 'var(--navy)', margin: '8px 0' }}>{now.toLocaleTimeString()}</div>
              <div style={{ color: 'var(--text-soft)', marginBottom: 18 }}>{now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
              {!today?.check_in ? (
                <button className="btn btn-success" onClick={checkIn} style={{ padding: '12px 32px', fontSize: 16 }}>Check In</button>
              ) : !today?.check_out ? (
                <button className="btn btn-warning" onClick={checkOut} style={{ padding: '12px 32px', fontSize: 16 }}>Check Out</button>
              ) : (
                <div className="success-msg" style={{ display: 'inline-block' }}>Day complete — {today.working_hours}h logged</div>
              )}
              {today?.check_in && (
                <div style={{ marginTop: 18, fontSize: 13, color: 'var(--text-soft)' }}>
                  In: <strong>{fmt(today.check_in)}</strong> · Out: <strong>{fmt(today.check_out)}</strong>
                </div>
              )}
            </div>
          </div>
          <div className="card">
            <div className="card-header"><h3>This Month</h3></div>
            <div className="card-body">
              {summary && (
                <div className="info-grid">
                  <div className="info-item"><label>Days Present</label><div className="value" style={{ fontSize: 24, color: 'var(--navy)' }}>{summary.days_present}</div></div>
                  <div className="info-item"><label>Total Hours</label><div className="value" style={{ fontSize: 24, color: 'var(--navy)' }}>{Math.round(summary.total_hours || 0)}h</div></div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header"><h3>Attendance Log</h3></div>
        <table className="table">
          <thead>
            <tr>{user.role !== 'employee' && <th>Employee</th>}<th>Date</th><th>Check In</th><th>Check Out</th><th>Working Hours</th><th>Status</th></tr>
          </thead>
          <tbody>
            {history.length === 0 && <tr><td colSpan="6" className="empty">No attendance records</td></tr>}
            {history.map(a => (
              <tr key={a.id}>
                {user.role !== 'employee' && <td><strong>{a.employee_name}</strong><div style={{ fontSize: 11, color: 'var(--text-soft)' }}>{a.employee_code}</div></td>}
                <td>{a.date}</td>
                <td>{fmt(a.check_in)}</td>
                <td>{fmt(a.check_out)}</td>
                <td>{a.working_hours ? `${a.working_hours}h` : '-'}</td>
                <td><span className="badge badge-success">{a.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
