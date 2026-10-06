import React, { useEffect, useState } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';

export default function Leaves() {
  const { user } = useAuth();
  const [leaves, setLeaves] = useState([]);
  const [balances, setBalances] = useState([]);
  const [types, setTypes] = useState([]);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({});
  const [error, setError] = useState('');
  const [tab, setTab] = useState('all');

  const load = () => {
    api.get('/leaves').then(r => setLeaves(r.data));
    api.get('/leaves/types').then(r => setTypes(r.data));
    if (user.role === 'employee') api.get('/leaves/balances').then(r => setBalances(r.data));
  };

  useEffect(() => { load(); }, []);

  const apply = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/leaves', form);
      setShow(false);
      setForm({});
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed');
    }
  };

  const approve = async (id) => { await api.post(`/leaves/${id}/approve`); load(); };
  const reject = async (id) => {
    const comments = window.prompt('Reason for rejection (optional):') || null;
    await api.post(`/leaves/${id}/reject`, { comments });
    load();
  };
  const cancel = async (id) => {
    if (!window.confirm('Cancel this leave?')) return;
    await api.post(`/leaves/${id}/cancel`);
    load();
  };

  const filtered = tab === 'all' ? leaves : leaves.filter(l => l.status === tab);

  return (
    <>
      <div className="page-hero hero-leaves">
        <div><h2>Leave Management</h2><p>Apply, track, and approve leave requests. Weekends are non-working days by default.</p></div>
        <button className="btn btn-primary" onClick={() => setShow(true)}>+ Apply Leave</button>
      </div>

      {user.role === 'employee' && balances.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header"><h3>My Leave Balances ({new Date().getFullYear()})</h3></div>
          <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
              {balances.map(b => {
                const remaining = b.total - b.used;
                return (
                  <div key={b.id} style={{ padding: 14, background: 'var(--bg)', borderRadius: 8 }}>
                    <div style={{ fontSize: 12, color: 'var(--text-soft)', textTransform: 'uppercase' }}>{b.leave_type_name}</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--navy)', marginTop: 4 }}>{remaining.toFixed(1)} <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--text-soft)' }}>/ {b.total}</span></div>
                    <div style={{ fontSize: 11, color: 'var(--text-mute)' }}>{b.used} used</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div className="toolbar">
        {['all','pending','approved','rejected','cancelled'].map(t => (
          <button key={t} className={`btn btn-sm ${tab === t ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
            {t === 'all' ? ` (${leaves.length})` : ` (${leaves.filter(l => l.status === t).length})`}
          </button>
        ))}
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              {user.role !== 'employee' && <th>Employee</th>}
              <th>Type</th><th>From</th><th>To</th><th>Days</th><th>Reason</th><th>Status / Decision</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan="8" className="empty">No leave requests</td></tr>}
            {filtered.map(l => {
              const isOwn = user.employee && l.employee_code === user.employee.employee_code;
              // A pending leave is actionable by:
              //   - a manager who is the employee's direct manager (backend enforces)
              //   - HR/admin when the employee has no manager (top-level) OR when HR is themselves the direct manager
              const canActOnPending =
                l.status === 'pending' && !isOwn && (
                  user.role === 'manager' ||
                  (user.role === 'admin' && (!l.employee_manager_id || l.employee_manager_id === user.employee?.id))
                );
              return (
                <tr key={l.id}>
                  {user.role !== 'employee' && <td><strong>{l.employee_name}</strong><div style={{ fontSize: 11, color: 'var(--text-soft)' }}>{l.employee_code}</div></td>}
                  <td>{l.leave_type_name}</td>
                  <td>{l.start_date}</td>
                  <td>{l.end_date}</td>
                  <td>{l.days}</td>
                  <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={l.reason}>{l.reason || '-'}</td>
                  <td>
                    <span className={`badge badge-${l.status === 'pending' ? 'warning' : l.status === 'approved' ? 'success' : 'danger'}`}>{l.status}</span>
                    {(l.status === 'approved' || l.status === 'rejected') && l.approver_name && (
                      <div style={{ fontSize: 11, color: 'var(--text-soft)', marginTop: 4 }}>
                        by <strong>{l.approver_name}</strong>
                      </div>
                    )}
                  </td>
                  <td>
                    {canActOnPending && (
                      <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 8, alignItems: 'stretch' }}>
                        <button className="btn btn-sm btn-success" onClick={() => approve(l.id)}>Approve</button>
                        <button className="btn btn-sm btn-danger" onClick={() => reject(l.id)}>Reject</button>
                      </div>
                    )}
                    {l.status === 'pending' && isOwn && (
                      <button className="btn btn-sm btn-secondary" onClick={() => cancel(l.id)}>Cancel</button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {show && (
        <div className="modal-overlay" onClick={() => setShow(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header"><h3>Apply for Leave</h3><span className="close-btn" onClick={() => setShow(false)}>×</span></div>
            <div className="modal-body">
              {error && <div className="error-msg">{error}</div>}
              <form onSubmit={apply}>
                <div className="form-group"><label>Leave Type *</label>
                  <select className="form-control" required value={form.leave_type_id || ''} onChange={(e) => setForm({ ...form, leave_type_id: e.target.value })}>
                    <option value="">-- Select --</option>
                    {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div className="form-grid">
                  <div className="form-group"><label>From *</label><input type="date" className="form-control" required value={form.start_date || ''} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
                  <div className="form-group"><label>To *</label><input type="date" className="form-control" required value={form.end_date || ''} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
                </div>
                <div className="form-group"><label>Reason</label><textarea className="form-control" value={form.reason || ''} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></div>
                <button className="btn btn-primary btn-block" type="submit">Submit Request</button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
