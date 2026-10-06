import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api';

export default function ActionCenter() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.get('/manager/action-center').then(r => setData(r.data)).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const approve = async (id) => { await api.post(`/leaves/${id}/approve`); load(); };
  const reject = async (id) => {
    const comments = window.prompt('Reason for rejection (optional):') || null;
    await api.post(`/leaves/${id}/reject`, { comments });
    load();
  };

  if (loading || !data) return <div className="loader" />;

  const allClear = data.total === 0;
  const sinceLabel = (n) => n == null ? 'Never given' : (n === 0 ? 'Today' : `${n} day${n > 1 ? 's' : ''} ago`);

  return (
    <>
      <div className="page-hero hero-dashboard">
        <div>
          <h2>Action Center</h2>
          <p>
            {allClear
              ? `Nothing needs your action right now across your ${data.team_size}-person team. 🎉`
              : `${data.total} item${data.total > 1 ? 's' : ''} need${data.total > 1 ? '' : 's'} your attention across your ${data.team_size}-person team.`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(8px)', padding: '14px 22px', borderRadius: 14, border: '1px solid rgba(255,255,255,0.3)' }}>
            <div style={{ fontSize: 32, fontWeight: 800, lineHeight: 1 }}>{data.total}</div>
            <div style={{ fontSize: 11, opacity: 0.9, textTransform: 'uppercase', letterSpacing: 1, marginTop: 4 }}>Open Actions</div>
          </div>
        </div>
      </div>

      <div className="metric-grid">
        <div className="metric-card pink">
          <div className="metric-label">Pending Leaves</div>
          <div className="metric-value">{data.pending_leaves.length}</div>
          <div className="metric-sub">From your team</div>
        </div>
        <div className="metric-card warning">
          <div className="metric-label">Missing Documents</div>
          <div className="metric-value">{data.missing_documents.length}</div>
          <div className="metric-sub">Reports with gaps</div>
        </div>
        <div className="metric-card indigo">
          <div className="metric-label">Overdue Feedback</div>
          <div className="metric-value">{data.overdue_feedback.length}</div>
          <div className="metric-sub">No feedback in {data.feedback_overdue_days}+ days</div>
        </div>
        <div className="metric-card success">
          <div className="metric-label">Team Size</div>
          <div className="metric-value">{data.team_size}</div>
          <div className="metric-sub">Active direct reports</div>
        </div>
      </div>

      {/* === Pending Leaves === */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <h3>🕒 Pending Leave Requests</h3>
          {data.pending_leaves.length > 0 && (
            <Link to="/leaves" className="btn btn-sm btn-secondary">Go to Leaves</Link>
          )}
        </div>
        {data.pending_leaves.length === 0 ? (
          <div className="empty">No pending leave requests from your team</div>
        ) : (
          <table className="table">
            <thead><tr><th>Employee</th><th>Type</th><th>From → To</th><th>Days</th><th>Reason</th><th>Applied</th><th>Actions</th></tr></thead>
            <tbody>
              {data.pending_leaves.map(l => (
                <tr key={l.id}>
                  <td><strong>{l.employee_name}</strong><div style={{ fontSize: 11, color: 'var(--text-soft)' }}>{l.employee_code}</div></td>
                  <td>{l.leave_type_name}</td>
                  <td style={{ fontSize: 12 }}>{l.start_date} → {l.end_date}</td>
                  <td><span className="badge badge-info">{l.days}d</span></td>
                  <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={l.reason}>{l.reason || '-'}</td>
                  <td style={{ fontSize: 11, color: 'var(--text-soft)' }}>{new Date(l.applied_at).toLocaleDateString()}</td>
                  <td>
                    <button className="btn btn-sm btn-success" onClick={() => approve(l.id)} style={{ marginRight: 4 }}>Approve</button>
                    <button className="btn btn-sm btn-danger" onClick={() => reject(l.id)}>Reject</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* === Missing Documents === */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <h3>📄 Missing Mandatory Documents</h3>
          {data.missing_documents.length > 0 && (
            <Link to="/documents" className="btn btn-sm btn-secondary">Document Compliance</Link>
          )}
        </div>
        {data.missing_documents.length === 0 ? (
          <div className="empty">All team members have submitted their mandatory documents 🎉</div>
        ) : (
          <table className="table">
            <thead><tr><th>Employee</th><th>Progress</th><th>Missing</th><th></th></tr></thead>
            <tbody>
              {data.missing_documents.map(m => {
                const uploaded = m.total_mandatory - m.missing_count;
                const pct = (uploaded / m.total_mandatory) * 100;
                return (
                  <tr key={m.employee_id}>
                    <td><strong>{m.name}</strong><div style={{ fontSize: 11, color: 'var(--text-soft)' }}>{m.employee_code}</div></td>
                    <td style={{ minWidth: 200 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, height: 8, background: 'var(--bg)', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: 'linear-gradient(90deg, #f59e0b, #d97706)' }} />
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 600, minWidth: 36 }}>{uploaded}/{m.total_mandatory}</span>
                      </div>
                    </td>
                    <td style={{ fontSize: 12 }}>
                      {m.missing.map(d => (
                        <span key={d} className="badge badge-warning" style={{ marginRight: 4, marginBottom: 2 }}>{d}</span>
                      ))}
                    </td>
                    <td>
                      <button className="btn btn-sm btn-secondary" onClick={() => navigate(`/employees/${m.employee_id}`)}>View</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* === Overdue Feedback === */}
      <div className="card">
        <div className="card-header">
          <h3>⭐ Overdue Performance Feedback</h3>
          {data.overdue_feedback.length > 0 && (
            <Link to="/feedback" className="btn btn-sm btn-secondary">Open Feedback</Link>
          )}
        </div>
        {data.overdue_feedback.length === 0 ? (
          <div className="empty">All reports have received feedback recently ⭐</div>
        ) : (
          <table className="table">
            <thead><tr><th>Employee</th><th>Last Feedback</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {data.overdue_feedback.map(f => (
                <tr key={f.employee_id}>
                  <td><strong>{f.name}</strong><div style={{ fontSize: 11, color: 'var(--text-soft)' }}>{f.employee_code}</div></td>
                  <td style={{ fontSize: 13 }}>{f.last_feedback_at ? new Date(f.last_feedback_at).toLocaleDateString() : '—'}</td>
                  <td>
                    <span className={`badge ${f.days_since == null ? 'badge-danger' : 'badge-warning'}`}>
                      {sinceLabel(f.days_since)}
                    </span>
                  </td>
                  <td>
                    <Link to="/feedback" className="btn btn-sm btn-primary">Give Feedback</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
