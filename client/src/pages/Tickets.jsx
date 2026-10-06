import React, { useEffect, useState } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';

const CATEGORIES = [
  { value: 'access', label: 'Account access' },
  { value: 'payroll', label: 'Payroll query' },
  { value: 'leave', label: 'Leave issue' },
  { value: 'offboarding', label: 'Offboarding / Resignation' },
  { value: 'other', label: 'Other' },
];
const catLabel = (v) => (CATEGORIES.find(c => c.value === v) || {}).label || 'Other';

export default function Tickets() {
  const { user } = useAuth();
  const isAdmin = user.role === 'admin';

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ category: 'other', subject: '', message: '' });
  const [msg, setMsg] = useState('');
  const [replies, setReplies] = useState({}); // { [ticketId]: { reply } }

  const load = () => api.get('/tickets').then(r => { setRows(r.data); setLoading(false); });
  useEffect(() => { load(); }, []);

  const raise = async (e) => {
    e.preventDefault();
    await api.post('/tickets', form);
    setShow(false);
    setForm({ category: 'other', subject: '', message: '' });
    setMsg('Your ticket has been raised. An admin will get back to you.');
    setTimeout(() => setMsg(''), 5000);
    load();
  };

  const sendReply = async (id, e) => {
    e.preventDefault();
    const body = replies[id] || {};
    if (!body.reply || !body.reply.trim()) return;
    await api.post(`/tickets/${id}/reply`, body);
    setReplies(prev => ({ ...prev, [id]: undefined }));
    load();
  };

  const setReply = (id, patch) =>
    setReplies(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  return (
    <>
      <div className="page-hero hero-tickets">
        <div>
          <h2>Help Desk</h2>
          <p>{isAdmin
            ? 'Support tickets raised by your team. Reply to resolve and notify them.'
            : 'Raise a ticket for password resets or account access — admin will respond here.'}</p>
        </div>
        {!isAdmin && (
          <button className="btn btn-primary" onClick={() => { setForm({ category: 'other', subject: '', message: '' }); setShow(true); }}>
            + Raise a ticket
          </button>
        )}
      </div>

      {msg && <div className="success-msg">{msg}</div>}

      {loading ? <div className="loader" /> : (
        <div className="ticket-list">
          {rows.length === 0 && <div className="empty">{isAdmin ? 'No tickets yet.' : 'You have not raised any tickets yet.'}</div>}

          {rows.map(t => {
            const resolved = t.status === 'resolved';
            return (
              <div key={t.id} className={`ticket-card ${resolved ? 'resolved' : ''}`}>
                <div className="ticket-head">
                  <h4>{t.subject}</h4>
                  <span className="badge badge-info">{catLabel(t.category)}</span>
                  <span className={`badge ${resolved ? 'badge-success' : 'badge-warning'}`}>{resolved ? 'Resolved' : 'Open'}</span>
                </div>

                {isAdmin && (
                  <div className="ticket-who">
                    From <b>{t.first_name ? `${t.first_name} ${t.last_name}` : t.user_email}</b>
                    {t.employee_code ? ` · ${t.employee_code}` : ''} · {new Date(t.created_at).toLocaleString()}
                  </div>
                )}
                {!isAdmin && <div className="ticket-who">{new Date(t.created_at).toLocaleString()}</div>}

                {t.message && <div className="ticket-msg">{t.message}</div>}

                {/* Resolved → show the admin's reply to everyone */}
                {resolved && t.admin_reply && (
                  <div className="ticket-reply">
                    <b>✓ Admin response</b>
                    {t.admin_reply}
                  </div>
                )}

                {/* Admin + still open → reply box */}
                {isAdmin && !resolved && (
                  <form className="ticket-replybox" onSubmit={(e) => sendReply(t.id, e)}>
                    <textarea
                      className="form-control"
                      placeholder="Write your response (this resolves the ticket and notifies the employee)…"
                      value={(replies[t.id]?.reply) || ''}
                      onChange={(e) => setReply(t.id, { reply: e.target.value })}
                      required
                    />
                    <button className="btn btn-success btn-sm" type="submit">Reply &amp; resolve</button>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      )}

      {show && (
        <div className="modal-overlay" onClick={() => setShow(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header"><h3>Raise a ticket</h3><span className="close-btn" onClick={() => setShow(false)}>×</span></div>
            <div className="modal-body">
              <form onSubmit={raise}>
                <div className="form-group">
                  <label>Category</label>
                  <select className="form-control" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Subject *</label>
                  <input className="form-control" required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Short summary of your request" />
                </div>
                <div className="form-group">
                  <label>Details</label>
                  <textarea className="form-control" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Describe the issue so admin can help faster" />
                </div>
                <button className="btn btn-primary btn-block" type="submit">Submit ticket</button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
