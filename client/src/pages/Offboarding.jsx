import React, { useEffect, useRef, useState } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';

const STATUS = {
  pending_manager: { label: 'With manager', cls: 'badge-warning' },
  cleared: { label: 'Ready to off-board', cls: 'badge-info' },
  completed: { label: 'Off-boarded', cls: 'badge-default' },
  cancelled: { label: 'Declined', cls: 'badge-default' },
};

const Tick = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
);
const Warn = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4 M12 17h.01 M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
);

function downloadItem(ob, item) {
  api.get(`/offboarding/${ob.id}/items/${item.id}/download`, { responseType: 'blob' }).then(r => {
    const url = window.URL.createObjectURL(new Blob([r.data]));
    const a = document.createElement('a');
    a.href = url;
    a.download = item.file_name || item.label;
    a.click();
    window.URL.revokeObjectURL(url);
  });
}

function ObMeta({ ob }) {
  return (
    <div className="ob-meta">
      <div><span>Reason</span><b>{ob.reason || '—'}</b></div>
      <div><span>Last working day</span><b>{ob.last_day || '—'}</b></div>
      {ob.notes && <div className="full"><span>Notes</span><b>{ob.notes}</b></div>}
    </div>
  );
}

/* Manager: clickable clearance tile (file -> picker, text -> prompt) */
function ClearanceTile({ ob, item, onChange }) {
  const fileRef = useRef();
  const [busy, setBusy] = useState(false);
  const has = !!item.submitted;

  const uploadFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setBusy(true);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const { data } = await api.post(`/offboarding/${ob.id}/items/${item.item_key}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      onChange(data);
    } catch (err) { alert(err.response?.data?.error || 'Upload failed'); }
    finally { setBusy(false); }
  };

  const enterText = async () => {
    const v = window.prompt(`Enter ${item.label}`, item.value || '');
    if (v == null || !v.trim()) return;
    setBusy(true);
    try {
      const { data } = await api.post(`/offboarding/${ob.id}/items/${item.item_key}`, { value: v.trim() });
      onChange(data);
    } catch (err) { alert(err.response?.data?.error || 'Save failed'); }
    finally { setBusy(false); }
  };

  const onClick = () => { if (busy) return; item.kind === 'file' ? fileRef.current.click() : enterText(); };

  const status = busy ? 'Saving…'
    : has ? (item.kind === 'file' ? `Uploaded · Click to replace` : item.value)
      : (item.kind === 'file' ? 'Click to upload' : 'Click to enter');

  return (
    <div className={`doc-tile doc-tile-clickable ${has ? 'done' : 'missing'}`} role="button" tabIndex={0}
      onClick={onClick} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}>
      <div className="doc-tile-icon">{has ? <Tick /> : <Warn />}</div>
      <div className="doc-tile-content">
        <div className="doc-tile-title">
          {item.label}
          {!has && <span className="badge badge-danger" style={{ padding: '1px 7px', fontSize: 10 }}>Required</span>}
        </div>
        <div className="doc-tile-status">{status}</div>
      </div>
      <input type="file" ref={fileRef} style={{ display: 'none' }} onChange={uploadFile} />
    </div>
  );
}

/* Employee: read-only tile (file -> download, text -> show value) */
function EmployeeTile({ ob, item }) {
  const has = !!item.submitted;
  const isFile = item.kind === 'file';
  const clickable = has && isFile;
  return (
    <div className={`doc-tile ${has ? 'done' : 'missing'} ${clickable ? 'doc-tile-clickable' : ''}`}
      role={clickable ? 'button' : undefined} onClick={() => clickable && downloadItem(ob, item)}>
      <div className="doc-tile-icon">{has ? <Tick /> : <Warn />}</div>
      <div className="doc-tile-content">
        <div className="doc-tile-title">{item.label}</div>
        <div className="doc-tile-status">{has ? (isFile ? 'Download' : item.value) : 'Pending'}</div>
      </div>
    </div>
  );
}

export default function Offboarding() {
  const { user } = useAuth();
  const role = user.role;
  const [list, setList] = useState([]);
  const [mine, setMine] = useState(null);
  const [msg, setMsg] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = async () => {
    if (role === 'admin') setList((await api.get('/offboarding')).data);
    else if (role === 'manager') setList((await api.get('/offboarding/manager')).data);
    else setMine((await api.get('/offboarding/employee')).data);
  };
  useEffect(() => { load(); }, []);

  const replaceInList = (rec) => setList((prev) => prev.map(o => o.id === rec.id ? { ...o, ...rec } : o));

  const approve = async (ob) => {
    setBusyId(ob.id); setMsg('');
    try { await api.post(`/offboarding/${ob.id}/approve`); await load(); }
    catch (e) { setMsg(e.response?.data?.error || 'Could not approve'); }
    finally { setBusyId(null); }
  };

  const decline = async (ob) => {
    if (!window.confirm(`Decline the off-boarding request for ${ob.employee_name}?`)) return;
    setBusyId(ob.id); setMsg('');
    try { await api.post(`/offboarding/${ob.id}/decline`); setMsg('Request declined. HR has been notified.'); await load(); }
    catch (e) { setMsg(e.response?.data?.error || 'Could not decline'); }
    finally { setBusyId(null); }
  };

  const submitClearances = async (ob) => {
    setBusyId(ob.id); setMsg('');
    try { await api.post(`/offboarding/${ob.id}/submit`); setMsg('Clearances submitted. HR has been notified.'); await load(); }
    catch (e) { setMsg(e.response?.data?.error || 'Could not submit'); }
    finally { setBusyId(null); }
  };

  const complete = async (ob) => {
    if (!window.confirm(`Off-board ${ob.employee_name}? This deactivates their account.`)) return;
    setBusyId(ob.id); setMsg('');
    try { await api.post(`/offboarding/${ob.id}/complete`); setMsg(`${ob.employee_name} has been off-boarded.`); await load(); }
    catch (e) { setMsg(e.response?.data?.error || 'Could not off-board'); }
    finally { setBusyId(null); }
  };

  return (
    <>
      <div className="page-hero hero-organization">
        <div>
          <h2>Off Boarding</h2>
          <p>
            {role === 'admin' && 'Track exit clearances and finalize employee off-boarding.'}
            {role === 'manager' && 'Review off-boarding requests, then submit the mandatory exit clearances.'}
            {role === 'employee' && 'View your relieving documents and exit clearances.'}
          </p>
        </div>
      </div>

      {msg && <div className="success-msg" style={{ marginBottom: 16 }}>{msg}</div>}

      {/* ============ HR / ADMIN ============ */}
      {role === 'admin' && (
        <div className="card">
          <div className="card-header"><h3>Off-boarding Requests</h3></div>
          <table className="table">
            <thead>
              <tr><th>Employee</th><th>Manager</th><th>Reason</th><th>Last Day</th><th>Clearances</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {list.length === 0 && <tr><td colSpan="7" className="empty">No off-boarding requests</td></tr>}
              {list.map(o => (
                <tr key={o.id}>
                  <td><strong>{o.employee_name}</strong><div style={{ fontSize: 11, color: 'var(--text-soft)' }}>{o.employee_code}</div></td>
                  <td>{o.manager_name || '—'}</td>
                  <td>{o.reason || '—'}</td>
                  <td>{o.last_day || '—'}</td>
                  <td>{o.submitted} / {o.total}</td>
                  <td>
                    <span className={`badge ${STATUS[o.status]?.cls}`}>{STATUS[o.status]?.label}</span>
                    {o.status === 'pending_manager' && !o.manager_approved && <div style={{ fontSize: 11, color: 'var(--text-soft)', marginTop: 2 }}>awaiting approval</div>}
                  </td>
                  <td>
                    {o.status === 'cleared'
                      ? <button className="btn btn-sm btn-danger" onClick={() => complete(o)} disabled={busyId === o.id}>Off Board</button>
                      : o.status === 'pending_manager'
                        ? <span style={{ fontSize: 12, color: 'var(--text-soft)' }}>Waiting for manager</span>
                        : <span style={{ fontSize: 12, color: 'var(--text-soft)' }}>—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ============ MANAGER ============ */}
      {role === 'manager' && (
        <>
          {list.length === 0 && <div className="card"><div className="card-body empty">No off-boarding requests for your team.</div></div>}
          {list.map(ob => {
            const allDone = ob.items.every(i => i.submitted);
            return (
              <div className="card" key={ob.id} style={{ marginBottom: 20 }}>
                <div className="card-header">
                  <h3>Off-boarding · {ob.employee_name}</h3>
                  {ob.manager_approved && <span style={{ fontSize: 12, color: 'var(--text-soft)' }}>{ob.submitted} / {ob.total} submitted</span>}
                </div>
                <div className="card-body">
                  <ObMeta ob={ob} />

                  {!ob.manager_approved ? (
                    <>
                      <p style={{ color: 'var(--text-soft)', marginBottom: 14 }}>
                        HR has requested off-boarding for <strong>{ob.employee_name}</strong>. Approve to begin collecting the exit clearance documents.
                      </p>
                      <div style={{ display: 'flex', gap: 10 }}>
                        <button className="btn btn-primary" onClick={() => approve(ob)} disabled={busyId === ob.id}>Approve & Start Clearances</button>
                        <button className="btn btn-secondary" onClick={() => decline(ob)} disabled={busyId === ob.id}>Decline</button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="doc-checklist">
                        {ob.items.map(item => <ClearanceTile key={item.id} ob={ob} item={item} onChange={replaceInList} />)}
                      </div>
                      <button className="btn btn-primary" style={{ marginTop: 16 }} disabled={!allDone || busyId === ob.id} onClick={() => submitClearances(ob)}>
                        {allDone ? 'Submit clearances to HR' : `Complete all ${ob.total} clearances first`}
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </>
      )}

      {/* ============ EMPLOYEE ============ */}
      {role === 'employee' && (
        !mine
          ? <div className="card"><div className="card-body empty">No off-boarding in progress.</div></div>
          : (
            <div className="card">
              <div className="card-header">
                <h3>My Exit Documents</h3>
                <span className={`badge ${STATUS[mine.status]?.cls}`}>{STATUS[mine.status]?.label}</span>
              </div>
              <div className="card-body">
                {!mine.manager_approved && mine.status === 'pending_manager' && (
                  <div className="error-msg" style={{ marginBottom: 16 }}>Your off-boarding is awaiting manager review. Documents will appear here once prepared.</div>
                )}
                <div className="doc-checklist">
                  {mine.items.map(item => <EmployeeTile key={item.id} ob={mine} item={item} />)}
                </div>
              </div>
            </div>
          )
      )}
    </>
  );
}
