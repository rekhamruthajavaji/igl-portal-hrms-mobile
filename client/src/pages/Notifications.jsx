import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';

export default function Notifications() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({});
  const [msg, setMsg] = useState('');

  const load = () => api.get('/notifications').then(r => setRows(r.data));
  useEffect(() => { load(); }, []);

  const open = async (n) => {
    if (!n.is_read) await api.post(`/notifications/${n.id}/read`);
    if (n.link) navigate(n.link);
    else load();
  };

  const markAll = async () => { await api.post('/notifications/read-all'); load(); };

  const broadcast = async (e) => {
    e.preventDefault();
    const { data } = await api.post('/notifications/broadcast', form);
    setMsg(`Sent to ${data.sent} users`);
    setShow(false);
    setForm({});
    setTimeout(() => setMsg(''), 4000);
  };

  return (
    <>
      <div className="page-hero hero-notifications">
        <div><h2>Notifications</h2><p>All your alerts, announcements, and approval updates.</p></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={markAll}>Mark all read</button>
          {user.role === 'admin' && <button className="btn btn-primary" onClick={() => setShow(true)}>+ Broadcast</button>}
        </div>
      </div>

      {msg && <div className="success-msg">{msg}</div>}

      <div className="card">
        {rows.length === 0 && <div className="empty">No notifications</div>}
        {rows.map(n => (
          <div key={n.id} className={`dropdown-item ${!n.is_read ? 'unread' : ''}`} onClick={() => open(n)} style={{ cursor: 'pointer' }}>
            <div className="dropdown-item-title">{n.title}</div>
            {n.message && <div className="dropdown-item-msg" style={{ fontSize: 13 }}>{n.message}</div>}
            <div className="dropdown-item-time">{new Date(n.created_at).toLocaleString()}</div>
          </div>
        ))}
      </div>

      {show && (
        <div className="modal-overlay" onClick={() => setShow(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header"><h3>Broadcast Notification</h3><span className="close-btn" onClick={() => setShow(false)}>×</span></div>
            <div className="modal-body">
              <form onSubmit={broadcast}>
                <div className="form-group"><label>Title *</label><input className="form-control" required value={form.title || ''} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
                <div className="form-group"><label>Message</label><textarea className="form-control" value={form.message || ''} onChange={(e) => setForm({ ...form, message: e.target.value })} /></div>
                <div className="form-group"><label>Type</label>
                  <select className="form-control" value={form.type || 'announcement'} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                    <option value="announcement">Announcement</option>
                    <option value="info">Info</option>
                    <option value="alert">Alert</option>
                  </select>
                </div>
                <button className="btn btn-primary btn-block" type="submit">Send to all employees</button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
