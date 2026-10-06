import React, { useEffect, useState } from 'react';
import api from '../api';

const initials = (u) => (u.first_name ? `${u.first_name[0]}${u.last_name[0]}` : (u.email[0] || '?').toUpperCase());
const fullName = (u) => (u.first_name ? `${u.first_name} ${u.last_name}` : u.email);
const genPassword = () => {
  // Readable but strong-ish: e.g. Hrms-4821xQ
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';
  const pick = (n, set) => Array.from({ length: n }, () => set[Math.floor(Math.random() * set.length)]).join('');
  return `Hrms-${Math.floor(1000 + Math.random() * 9000)}${pick(2, chars)}`;
};

export default function Access() {
  const [data, setData] = useState({ requests: [], users: [] });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [target, setTarget] = useState(null);   // { userId, name, ticketId? }
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [lastReset, setLastReset] = useState(null); // { name, password }

  const load = () => api.get('/access/overview').then(r => { setData(r.data); setLoading(false); });
  useEffect(() => { load(); }, []);

  const openReset = (userId, name, ticketId) => {
    setTarget({ userId, name, ticketId });
    setPw('');
    setErr('');
  };

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    if (pw.trim().length < 6) { setErr('Password must be at least 6 characters'); return; }
    try {
      await api.post('/access/reset', { userId: target.userId, newPassword: pw.trim(), ticketId: target.ticketId });
      setLastReset({ name: target.name, password: pw.trim() });
      setMsg(`Password reset for ${target.name}.`);
      setTarget(null);
      setPw('');
      load();
      setTimeout(() => setMsg(''), 6000);
    } catch (e2) {
      setErr(e2.response?.data?.error || 'Failed to reset password');
    }
  };

  const q = search.trim().toLowerCase();
  const users = data.users.filter(u =>
    !q || fullName(u).toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || (u.employee_code || '').toLowerCase().includes(q));

  return (
    <>
      <div className="page-hero hero-access">
        <div>
          <h2>Password Management</h2>
          <p>Reset passwords for employees who requested it, or for anyone in the directory. Each reset notifies the employee and closes their request.</p>
        </div>
      </div>

      {msg && <div className="success-msg">{msg}</div>}

      {lastReset && (
        <div className="card" style={{ marginBottom: 20, borderColor: 'var(--success)' }}>
          <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13 }}>
              New password for <b>{lastReset.name}</b> — share it with them securely:
            </span>
            <span className="pw-reveal">{lastReset.password}</span>
            <button className="btn btn-secondary btn-sm" onClick={() => { navigator.clipboard?.writeText(lastReset.password); }}>Copy</button>
            <button className="btn btn-secondary btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setLastReset(null)}>Dismiss</button>
          </div>
        </div>
      )}

      {/* Pending password requests */}
      <div className="card" style={{ marginBottom: 22 }}>
        <div className="card-header">
          <h3>Pending password requests</h3>
          <span className="badge badge-warning">{data.requests.length} open</span>
        </div>
        <div className="card-body">
          {loading ? <div className="loader" /> : data.requests.length === 0 ? (
            <div className="empty">No pending password requests. 🎉</div>
          ) : (
            <div className="ticket-list">
              {data.requests.map(r => (
                <div key={r.ticket_id} className="req-card">
                  <div className="avatar">{initials(r)}</div>
                  <div className="req-info">
                    <h4>{fullName(r)}</h4>
                    <p>{r.email}{r.employee_code ? ` · ${r.employee_code}` : ''} · requested {new Date(r.created_at).toLocaleDateString()}</p>
                  </div>
                  <button className="btn btn-primary btn-sm" onClick={() => openReset(r.user_id, fullName(r), r.ticket_id)}>Reset password</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Full directory */}
      <div className="card">
        <div className="card-header">
          <h3>All employees</h3>
          <input className="form-control" style={{ width: 240 }} placeholder="Search name, email, code…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <table className="table">
          <thead>
            <tr><th>Employee</th><th>Email</th><th>Role</th><th style={{ textAlign: 'right' }}>Action</th></tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.user_id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div className="avatar" style={{ width: 30, height: 30, fontSize: 11 }}>{initials(u)}</div>
                    <div>
                      <div style={{ fontWeight: 600 }}>{fullName(u)}</div>
                      {u.designation && <div style={{ fontSize: 11, color: 'var(--text-mute)' }}>{u.designation}</div>}
                    </div>
                  </div>
                </td>
                <td>{u.email}</td>
                <td><span className={`badge ${u.role === 'manager' ? 'badge-info' : 'badge-default'}`}>{u.role}</span></td>
                <td style={{ textAlign: 'right' }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => openReset(u.user_id, fullName(u))}>Reset password</button>
                </td>
              </tr>
            ))}
            {users.length === 0 && <tr><td colSpan={4}><div className="empty">No matching employees.</div></td></tr>}
          </tbody>
        </table>
      </div>

      {/* Reset modal */}
      {target && (
        <div className="modal-overlay" onClick={() => setTarget(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div className="modal-header"><h3>Reset password</h3><span className="close-btn" onClick={() => setTarget(null)}>×</span></div>
            <div className="modal-body">
              <p style={{ marginTop: 0, fontSize: 13, color: 'var(--text-soft)' }}>
                Set a new password for <b>{target.name}</b>. They'll be notified
                {target.ticketId ? ' and their request will be marked resolved.' : '.'}
              </p>
              {err && <div className="error-msg">{err}</div>}
              <form onSubmit={submit}>
                <div className="form-group">
                  <label>New password</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input className="form-control" type="text" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="At least 6 characters" required autoFocus />
                    <button type="button" className="btn btn-secondary" onClick={() => setPw(genPassword())}>Generate</button>
                  </div>
                </div>
                <button className="btn btn-primary btn-block" type="submit">Reset &amp; notify</button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
