import React, { useEffect, useState } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';

export default function Feedback() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [emps, setEmps] = useState([]);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ rating: 4 });
  const [error, setError] = useState('');

  const load = () => api.get('/feedback').then(r => setRows(r.data));
  useEffect(() => {
    load();
    if (user.role !== 'employee') api.get('/employees').then(r => setEmps(r.data));
  }, []);

  const save = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/feedback', form);
      setShow(false);
      setForm({ rating: 4 });
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed');
    }
  };

  const canGive = user.role === 'admin' || user.role === 'manager';

  return (
    <>
      <div className="page-hero hero-feedback">
        <div><h2>Performance Feedback</h2><p>Strengths, improvements, goals, and a 5-point rating scale.</p></div>
        {canGive && <button className="btn btn-primary" onClick={() => setShow(true)}>+ New Feedback</button>}
      </div>

      <div style={{ display: 'grid', gap: 16 }}>
        {rows.length === 0 && <div className="card"><div className="empty">No feedback yet</div></div>}
        {rows.map(f => (
          <div key={f.id} className="card">
            <div className="card-header">
              <div>
                <h3 style={{ marginBottom: 2 }}>{f.employee_name}</h3>
                <div style={{ fontSize: 12, color: 'var(--text-soft)' }}>By {f.manager_name || 'HR'} · {f.period} · {new Date(f.created_at).toLocaleDateString()}</div>
              </div>
              {f.rating != null && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ color: '#f59e0b', fontSize: 16 }}>{'★'.repeat(Math.round(f.rating))}{'☆'.repeat(5 - Math.round(f.rating))}</div>
                  <strong style={{ color: 'var(--navy)' }}>{f.rating}/5</strong>
                </div>
              )}
            </div>
            <div className="card-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 18 }}>
              {f.strengths && <div><div style={{ fontSize: 11, color: 'var(--success)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>Strengths</div><div style={{ fontSize: 13 }}>{f.strengths}</div></div>}
              {f.improvements && <div><div style={{ fontSize: 11, color: 'var(--warning)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>Improvements</div><div style={{ fontSize: 13 }}>{f.improvements}</div></div>}
              {f.goals && <div><div style={{ fontSize: 11, color: 'var(--blue)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>Goals</div><div style={{ fontSize: 13 }}>{f.goals}</div></div>}
            </div>
          </div>
        ))}
      </div>

      {show && (
        <div className="modal-overlay" onClick={() => setShow(false)}>
          <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header"><h3>New Feedback</h3><span className="close-btn" onClick={() => setShow(false)}>×</span></div>
            <div className="modal-body">
              {error && <div className="error-msg">{error}</div>}
              <form onSubmit={save}>
                <div className="form-grid">
                  <div className="form-group"><label>Employee *</label>
                    <select className="form-control" required value={form.employee_id || ''} onChange={(e) => setForm({ ...form, employee_id: e.target.value })}>
                      <option value="">-- Select --</option>
                      {emps.filter(e => e.role === 'employee').map(e => <option key={e.id} value={e.id}>{e.first_name} {e.last_name} ({e.employee_code})</option>)}
                    </select>
                  </div>
                  <div className="form-group"><label>Period *</label><input className="form-control" required placeholder="e.g. Q2 2026" value={form.period || ''} onChange={(e) => setForm({ ...form, period: e.target.value })} /></div>
                </div>
                <div className="form-group"><label>Strengths</label><textarea className="form-control" value={form.strengths || ''} onChange={(e) => setForm({ ...form, strengths: e.target.value })} /></div>
                <div className="form-group"><label>Areas of Improvement</label><textarea className="form-control" value={form.improvements || ''} onChange={(e) => setForm({ ...form, improvements: e.target.value })} /></div>
                <div className="form-group"><label>Goals</label><textarea className="form-control" value={form.goals || ''} onChange={(e) => setForm({ ...form, goals: e.target.value })} /></div>
                <div className="form-group"><label>Rating: {form.rating}/5</label><input type="range" min="1" max="5" step="0.1" value={form.rating || 4} onChange={(e) => setForm({ ...form, rating: Number(e.target.value) })} style={{ width: '100%' }} /></div>
                <button className="btn btn-primary btn-block" type="submit">Submit Feedback</button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
