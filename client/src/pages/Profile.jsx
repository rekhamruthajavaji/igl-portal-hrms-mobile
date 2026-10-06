import React, { useEffect, useState } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';

export default function Profile() {
  const { user } = useAuth();
  const [emp, setEmp] = useState(null);
  const [editInfo, setEditInfo] = useState(false);
  const [form, setForm] = useState({});
  const [msg, setMsg] = useState('');

  // Change-password modal
  const [pwOpen, setPwOpen] = useState(false);
  const [pw, setPw] = useState({ newPassword: '', confirm: '' });
  const [pwMsg, setPwMsg] = useState({ type: '', text: '' });
  const [pwBusy, setPwBusy] = useState(false);

  const load = () => api.get(`/employees/${user.employee.id}`).then(r => { setEmp(r.data); setForm(r.data); });
  useEffect(() => { if (user?.employee?.id) load(); }, []);

  const upd = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const saveInfo = async (e) => {
    e.preventDefault();
    await api.put('/employees/self', { phone: form.phone ?? null, dob: form.dob ?? null, state: form.state ?? null, address: form.address ?? null });
    await load();
    setEditInfo(false);
    setMsg('✓ Your details were updated.');
    setTimeout(() => setMsg(''), 4000);
  };

  const changePassword = async (e) => {
    e.preventDefault();
    setPwMsg({});
    if (pw.newPassword.length < 6) { setPwMsg({ type: 'error', text: 'Password must be at least 6 characters' }); return; }
    if (pw.newPassword !== pw.confirm) { setPwMsg({ type: 'error', text: 'Passwords do not match' }); return; }
    setPwBusy(true);
    try {
      await api.post('/auth/set-password', { newPassword: pw.newPassword });
      setPwMsg({ type: 'success', text: '✓ Password updated. Use it next time you sign in.' });
      setPw({ newPassword: '', confirm: '' });
      setTimeout(() => { setPwOpen(false); setPwMsg({}); }, 1500);
    } catch (err) {
      setPwMsg({ type: 'error', text: err.response?.data?.error || 'Failed to update password' });
    } finally {
      setPwBusy(false);
    }
  };

  if (!emp) return <div className="loader" />;

  const Row = ({ label, children }) => (
    <div className="info-item"><label>{label}</label><div className="value">{children ?? '-'}</div></div>
  );

  return (
    <>
      <div className="profile-header">
        <div className="avatar avatar-lg">{emp.first_name[0]}{emp.last_name[0]}</div>
        <div style={{ flex: 1 }}>
          <h2>{emp.first_name} {emp.last_name}</h2>
          <div className="designation">{emp.designation || 'Team Member'} · {emp.department_name || 'No department'}</div>
          <div style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>{emp.email} · Code: {emp.employee_code}</div>
        </div>
      </div>

      {msg && <div className="success-msg">{msg}</div>}

      <div className="grid-2">
        {/* My Information */}
        <div className="card">
          <div className="card-header">
            <h3>My Information</h3>
            {!editInfo && <button className="btn btn-sm btn-secondary" onClick={() => { setForm(emp); setEditInfo(true); }}>Edit</button>}
          </div>
          <div className="card-body">
            {!editInfo ? (
              <div className="info-grid">
                <Row label="Phone">{emp.phone}</Row>
                <Row label="Date of Birth">{emp.dob}</Row>
                <Row label="Joining Date">{emp.joining_date}</Row>
                <Row label="State">{emp.state}</Row>
                <Row label="Manager">{emp.manager_name}</Row>
                <Row label="Team">{emp.team_name}</Row>
                <div className="info-item" style={{ gridColumn: '1 / -1' }}><label>Address</label><div className="value">{emp.address || '-'}</div></div>
              </div>
            ) : (
              <form onSubmit={saveInfo}>
                <div className="form-grid">
                  <div className="form-group"><label>Phone</label><input className="form-control" value={form.phone || ''} onChange={(e) => upd('phone', e.target.value)} /></div>
                  <div className="form-group"><label>Date of Birth</label><input type="date" className="form-control" value={form.dob || ''} onChange={(e) => upd('dob', e.target.value)} /></div>
                  <div className="form-group"><label>State</label><input className="form-control" value={form.state || ''} onChange={(e) => upd('state', e.target.value)} /></div>
                  <div className="form-group full"><label>Address</label><textarea className="form-control" value={form.address || ''} onChange={(e) => upd('address', e.target.value)} /></div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-primary" type="submit">Save changes</button>
                  <button className="btn btn-secondary" type="button" onClick={() => setEditInfo(false)}>Cancel</button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* Password & Security — self-service change */}
        <div className="card">
          <div className="card-header"><h3>Password &amp; Security</h3></div>
          <div className="card-body">
            <p style={{ fontSize: 13, color: 'var(--text-soft)', marginTop: 0, lineHeight: 1.6 }}>
              Update your account password anytime. Choose a strong password you'll remember.
            </p>
            <button className="btn btn-primary" onClick={() => { setPw({ newPassword: '', confirm: '' }); setPwMsg({}); setPwOpen(true); }}>
              Change Password
            </button>
          </div>
        </div>
      </div>

      {/* Bank & Tax details — view only */}
      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-header"><h3>Bank &amp; Tax Details</h3></div>
        <div className="card-body">
          <div className="info-grid">
            <Row label="Bank Name">{emp.bank_name}</Row>
            <Row label="Account Number">{emp.bank_account}</Row>
            <Row label="IFSC">{emp.ifsc}</Row>
            <Row label="PAN">{emp.pan}</Row>
          </div>
        </div>
      </div>

      {/* Change Password modal */}
      {pwOpen && (
        <div className="modal-overlay" onClick={() => setPwOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div className="modal-header"><h3>Change Password</h3><span className="close-btn" onClick={() => setPwOpen(false)}>×</span></div>
            <div className="modal-body">
              {pwMsg.type === 'error' && <div className="error-msg">{pwMsg.text}</div>}
              {pwMsg.type === 'success' && <div className="success-msg">{pwMsg.text}</div>}
              <form onSubmit={changePassword}>
                <div className="form-group"><label>New Password</label><input type="password" className="form-control" required value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} placeholder="At least 6 characters" autoFocus /></div>
                <div className="form-group"><label>Confirm New Password</label><input type="password" className="form-control" required value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} /></div>
                <button className="btn btn-primary btn-block" type="submit" disabled={pwBusy}>{pwBusy ? 'Updating…' : 'Update Password'}</button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
