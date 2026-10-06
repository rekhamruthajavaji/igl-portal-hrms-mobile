import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';

const STATES = ['AP','AS','BR','CG','DL','GA','GJ','HR','HP','JK','JH','KA','KL','MP','MH','MN','OD','PB','RJ','TN','TS','UP','UK','WB'];

export default function Employees() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState('');
  const [show, setShow] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [managers, setManagers] = useState([]);
  const [form, setForm] = useState({});
  const [error, setError] = useState('');
  const [created, setCreated] = useState(null);
  const [showOff, setShowOff] = useState(false);
  const [offForm, setOffForm] = useState({});
  const [offError, setOffError] = useState('');
  const [offDone, setOffDone] = useState(false);

  const load = () => api.get('/employees').then(r => setRows(r.data));
  const loadMeta = () => {
    api.get('/org/departments').then(r => setDepartments(r.data));
    api.get('/employees').then(r => setManagers(r.data.filter(e => e.role === 'admin' || e.role === 'manager')));
  };

  useEffect(() => { load(); loadMeta(); }, []);

  const filtered = rows.filter(r => {
    const q = filter.toLowerCase();
    return !q || r.first_name.toLowerCase().includes(q) || r.last_name.toLowerCase().includes(q) ||
      r.employee_code.toLowerCase().includes(q) || (r.email || '').toLowerCase().includes(q) ||
      (r.designation || '').toLowerCase().includes(q);
  });

  const save = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const { data } = await api.post('/employees', form);
      setCreated({ password: data.defaultPassword, email: form.email });
      setForm({});
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create');
    }
  };

  const offboard = async (e) => {
    e.preventDefault();
    setOffError('');
    if (!offForm.employee_id) { setOffError('Select an employee to off-board'); return; }
    try {
      await api.post('/offboarding', {
        employee_id: offForm.employee_id,
        last_day: offForm.last_day,
        reason: offForm.reason,
        notes: offForm.notes,
      });
      setOffDone(true);
      load();
    } catch (err) {
      setOffError(err.response?.data?.error || 'Failed to start off-boarding');
    }
  };

  const closeOff = () => { setShowOff(false); setOffDone(false); setOffForm({}); setOffError(''); };

  return (
    <>
      <div className="page-hero hero-employees">
        <div><h2>Employees</h2><p>Manage your workforce across departments and teams.</p></div>
        {user.role === 'admin' && (
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-primary" onClick={() => setShow(true)}>On Boarding</button>
            <button className="btn btn-primary" style={{ background: 'rgba(255,255,255,0.16)' }} onClick={() => setShowOff(true)}>Off Boarding</button>
          </div>
        )}
      </div>

      <div className="toolbar">
        <input placeholder="Search by name, code, email, designation..." value={filter} onChange={(e) => setFilter(e.target.value)} style={{ minWidth: 320 }} />
        <span style={{ color: 'var(--text-soft)', fontSize: 13 }}>{filtered.length} of {rows.length}</span>
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr><th>Code</th><th>Name</th><th>Designation</th><th>Department</th><th>Manager</th><th>Joining</th><th>Status</th></tr>
          </thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan="7" className="empty">No employees found</td></tr>}
            {filtered.map(e => (
              <tr key={e.id}>
                <td><Link to={`/employees/${e.id}`}><strong>{e.employee_code}</strong></Link></td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div className="avatar" style={{ width: 28, height: 28, fontSize: 11 }}>{e.first_name[0]}{e.last_name[0]}</div>
                    <div>
                      <div><strong>{e.first_name} {e.last_name}</strong></div>
                      <div style={{ fontSize: 12, color: 'var(--text-soft)' }}>{e.email}</div>
                    </div>
                  </div>
                </td>
                <td>{e.designation || '-'}</td>
                <td>{e.department_name || '-'}</td>
                <td>{e.manager_name || '-'}</td>
                <td>{e.joining_date}</td>
                <td><span className={`badge ${e.employment_status === 'active' ? 'badge-success' : 'badge-default'}`}>{e.employment_status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {show && (
        <div className="modal-overlay" onClick={() => { setShow(false); setCreated(null); }}>
          <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Employee On Boarding</h3>
              <span className="close-btn" onClick={() => { setShow(false); setCreated(null); }}>×</span>
            </div>
            <div className="modal-body">
              {created && (
                <div className="success-msg">
                  Created! Login: <code>{created.email}</code> · Password: <code>{created.password}</code>
                </div>
              )}
              {error && <div className="error-msg">{error}</div>}
              <form onSubmit={save}>
                <div className="form-grid">
                  <div className="form-group"><label>First Name *</label><input className="form-control" required value={form.first_name || ''} onChange={(e) => setForm({ ...form, first_name: e.target.value })} /></div>
                  <div className="form-group"><label>Last Name *</label><input className="form-control" required value={form.last_name || ''} onChange={(e) => setForm({ ...form, last_name: e.target.value })} /></div>
                  <div className="form-group"><label>Email *</label><input type="email" className="form-control" required value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                  <div className="form-group"><label>Role *</label>
                    <select className="form-control" value={form.role || 'employee'} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                      <option value="employee">Employee</option>
                      <option value="manager">Manager</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <div className="form-group"><label>Phone</label><input className="form-control" value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                  <div className="form-group"><label>Gender</label>
                    <select className="form-control" value={form.gender || ''} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                      <option value="">Select</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option>
                    </select>
                  </div>
                  <div className="form-group"><label>Joining Date *</label><input type="date" className="form-control" required value={form.joining_date || ''} onChange={(e) => setForm({ ...form, joining_date: e.target.value })} /></div>
                  <div className="form-group"><label>Designation</label><input className="form-control" value={form.designation || ''} onChange={(e) => setForm({ ...form, designation: e.target.value })} /></div>
                  <div className="form-group"><label>Department</label>
                    <select className="form-control" value={form.department_id || ''} onChange={(e) => setForm({ ...form, department_id: e.target.value })}>
                      <option value="">-- Select --</option>
                      {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group"><label>Manager</label>
                    <select className="form-control" value={form.manager_id || ''} onChange={(e) => setForm({ ...form, manager_id: e.target.value })}>
                      <option value="">-- None --</option>
                      {managers.map(m => <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>)}
                    </select>
                  </div>
                  <div className="form-group"><label>State</label>
                    <select className="form-control" value={form.state || ''} onChange={(e) => setForm({ ...form, state: e.target.value })}>
                      <option value="">-- Select --</option>
                      {STATES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="form-group full"><label>Address</label><input className="form-control" value={form.address || ''} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
                  <div className="form-group"><label>Basic Salary</label><input type="number" className="form-control" value={form.basic_salary || ''} onChange={(e) => setForm({ ...form, basic_salary: e.target.value })} /></div>
                  <div className="form-group"><label>HRA</label><input type="number" className="form-control" value={form.hra || ''} onChange={(e) => setForm({ ...form, hra: e.target.value })} /></div>
                  <div className="form-group"><label>Allowances</label><input type="number" className="form-control" value={form.allowances || ''} onChange={(e) => setForm({ ...form, allowances: e.target.value })} /></div>
                  <div className="form-group"><label>Deductions</label><input type="number" className="form-control" value={form.deductions || ''} onChange={(e) => setForm({ ...form, deductions: e.target.value })} /></div>
                </div>
                <button className="btn btn-primary" type="submit">Create Employee</button>
              </form>
            </div>
          </div>
        </div>
      )}

      {showOff && (
        <div className="modal-overlay" onClick={closeOff}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Employee Off Boarding</h3>
              <span className="close-btn" onClick={closeOff}>×</span>
            </div>
            <div className="modal-body">
              {offDone ? (
                <div className="success-msg">
                  Off-boarding started. The employee's <strong>manager</strong> has been notified to submit the exit clearances.
                  Once all clearances are complete, you'll be notified to finalize the off-boarding from the <strong>Off Boarding</strong> page.
                </div>
              ) : (
                <>
                  {offError && <div className="error-msg">{offError}</div>}
                  <form onSubmit={offboard}>
                    <div className="form-grid">
                      <div className="form-group full"><label>Employee *</label>
                        <select className="form-control" required value={offForm.employee_id || ''} onChange={(e) => setOffForm({ ...offForm, employee_id: e.target.value })}>
                          <option value="">-- Select employee --</option>
                          {rows.filter(r => r.employment_status === 'active').map(r => (
                            <option key={r.id} value={r.id}>{r.first_name} {r.last_name} ({r.employee_code})</option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group"><label>Last Working Day</label><input type="date" className="form-control" value={offForm.last_day || ''} onChange={(e) => setOffForm({ ...offForm, last_day: e.target.value })} /></div>
                      <div className="form-group"><label>Reason</label>
                        <select className="form-control" value={offForm.reason || ''} onChange={(e) => setOffForm({ ...offForm, reason: e.target.value })}>
                          <option value="">-- Select --</option>
                          <option>Resignation</option>
                          <option>Termination</option>
                          <option>Retirement</option>
                          <option>End of contract</option>
                          <option>Other</option>
                        </select>
                      </div>
                      <div className="form-group full"><label>Notes</label><textarea className="form-control" value={offForm.notes || ''} onChange={(e) => setOffForm({ ...offForm, notes: e.target.value })} /></div>
                    </div>
                    <button className="btn btn-danger" type="submit">Off Board Employee</button>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
