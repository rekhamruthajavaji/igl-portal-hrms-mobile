import React, { useEffect, useRef, useState } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';

export default function Documents() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [types, setTypes] = useState([]);
  const [status, setStatus] = useState([]);
  const [uploadingType, setUploadingType] = useState(null);
  const [err, setErr] = useState('');
  const fileRef = useRef();
  const pendingTypeRef = useRef(null);

  const load = async () => {
    const [docs, t] = await Promise.all([
      api.get('/documents'),
      api.get('/documents/types'),
    ]);
    setRows(docs.data);
    setTypes(t.data);
    if (user.role !== 'employee') {
      const s = await api.get('/documents/status');
      setStatus(s.data);
    }
  };
  useEffect(() => { load(); }, []);

  const myUploaded = new Set(rows.filter(r => !r.employee_name || r.employee_code === user.employee?.employee_code).map(r => r.type));
  const myProgress = types.filter(t => t.mandatory && myUploaded.has(t.name)).length;
  const myTotalMandatory = types.filter(t => t.mandatory).length;
  const myPct = myTotalMandatory ? (myProgress / myTotalMandatory) * 100 : 0;

  // Click a checklist tile -> open the file picker for that document type
  const onTileClick = (t) => {
    if (uploadingType) return;
    setErr('');
    pendingTypeRef.current = t.name;
    fileRef.current.value = '';
    fileRef.current.click();
  };

  const onFilePicked = async (e) => {
    const file = e.target.files[0];
    const typeName = pendingTypeRef.current;
    if (!file || !typeName) return;
    setUploadingType(typeName);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('name', typeName);
    fd.append('type', typeName);
    try {
      await api.post('/documents/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      await load();
    } catch (e2) {
      setErr(e2.response?.data?.error || 'Upload failed');
    } finally {
      setUploadingType(null);
      pendingTypeRef.current = null;
    }
  };

  const download = async (d) => {
    const r = await api.get(`/documents/${d.id}/download`, { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([r.data]));
    const a = document.createElement('a');
    a.href = url;
    a.download = d.name;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const del = async (id) => {
    if (!window.confirm('Delete this document?')) return;
    await api.delete(`/documents/${id}`);
    load();
  };

  const docIcon = (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8" /></svg>
  );
  const tickIcon = (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
  );
  const warnIcon = (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4 M12 17h.01 M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /></svg>
  );

  return (
    <>
      <div className="page-hero hero-documents">
        <div>
          <h2>Documents</h2>
          <p>Upload your HR documents. Aadhar Card, PAN Card, Offer Letter and Provisional Certificate are mandatory.</p>
        </div>
        {user.role === 'employee' && (
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <svg className="progress-ring" viewBox="0 0 56 56">
              <circle className="progress-ring-bg" cx="28" cy="28" r="22" />
              <circle className="progress-ring-fg" cx="28" cy="28" r="22"
                strokeDasharray={2 * Math.PI * 22}
                strokeDashoffset={(2 * Math.PI * 22) * (1 - myPct / 100)} />
            </svg>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800 }}>{myProgress} / {myTotalMandatory}</div>
              <div style={{ fontSize: 12, opacity: 0.9 }}>Mandatory uploaded</div>
            </div>
          </div>
        )}
      </div>

      {/* Hidden file input — triggered by clicking a checklist tile */}
      <input type="file" ref={fileRef} onChange={onFilePicked} style={{ display: 'none' }} />

      {/* Checklist (employee view) — click a tile to upload that document */}
      {user.role === 'employee' && types.length > 0 && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <h3>Your Document Checklist</h3>
            <span style={{ fontSize: 12, color: 'var(--text-soft)' }}>{myProgress === myTotalMandatory ? 'All mandatory documents uploaded' : `${myTotalMandatory - myProgress} mandatory document(s) missing`}</span>
          </div>
          <div className="card-body">
            {err && <div className="error-msg" style={{ marginBottom: 12 }}>{err}</div>}
            <div className="doc-checklist">
              {types.map(t => {
                const has = myUploaded.has(t.name);
                const isUploading = uploadingType === t.name;
                const cls = `doc-tile doc-tile-clickable ${has ? 'done' : 'missing'} ${t.mandatory ? '' : 'optional'}`;
                return (
                  <div key={t.code} className={cls} role="button" tabIndex={0}
                    onClick={() => onTileClick(t)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onTileClick(t); } }}
                    title={`Click to upload ${t.name}`}>
                    <div className="doc-tile-icon">{has ? tickIcon : (t.mandatory ? warnIcon : docIcon)}</div>
                    <div className="doc-tile-content">
                      <div className="doc-tile-title">
                        {t.name}
                        {!has && t.mandatory && <span className="badge badge-danger" style={{ padding: '1px 7px', fontSize: 10 }}>Mandatory</span>}
                        {!has && !t.mandatory && <span className="badge badge-default" style={{ padding: '1px 7px', fontSize: 10 }}>Optional</span>}
                      </div>
                      <div className="doc-tile-status">
                        {isUploading ? 'Uploading…' : has ? 'Uploaded · Click to replace' : 'Click to upload'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* HR / Manager — completion status across team */}
      {user.role !== 'employee' && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <h3>Team Document Compliance</h3>
            <span style={{ fontSize: 12, color: 'var(--text-soft)' }}>
              {status.filter(s => s.complete).length} / {status.length} employees compliant
            </span>
          </div>
          <table className="table">
            <thead>
              <tr><th>Employee</th><th>Progress</th><th>Status</th><th>Missing Documents</th></tr>
            </thead>
            <tbody>
              {status.length === 0 && <tr><td colSpan="4" className="empty">No employees</td></tr>}
              {status.map(s => {
                const pct = (s.uploaded / s.total_required) * 100;
                return (
                  <tr key={s.employee_id}>
                    <td>
                      <strong>{s.name}</strong>
                      <div style={{ fontSize: 11, color: 'var(--text-soft)' }}>{s.employee_code}</div>
                    </td>
                    <td style={{ minWidth: 180 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, height: 8, background: 'var(--bg)', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ width: `${pct}%`, height: '100%', background: s.complete ? 'linear-gradient(90deg, #10b981, #059669)' : 'linear-gradient(90deg, #f59e0b, #d97706)' }} />
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 600, minWidth: 40 }}>{s.uploaded} / {s.total_required}</span>
                      </div>
                    </td>
                    <td>
                      {s.complete
                        ? <span className="badge badge-success">Compliant</span>
                        : <span className="badge badge-warning">{s.missing.length} missing</span>}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-soft)' }}>
                      {s.missing.length === 0 ? '—' : s.missing.join(', ')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* All documents list */}
      <div className="card">
        <div className="card-header"><h3>{user.role === 'employee' ? 'My Uploaded Documents' : 'All Uploaded Documents'}</h3></div>
        <table className="table">
          <thead>
            <tr>{user.role !== 'employee' && <th>Employee</th>}<th>Type</th><th>File Name</th><th>Size</th><th>Uploaded</th><th></th></tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={user.role !== 'employee' ? 6 : 5} className="empty">No documents</td></tr>}
            {rows.map(d => (
              <tr key={d.id}>
                {user.role !== 'employee' && <td>{d.employee_name || '-'}</td>}
                <td>
                  <span className="badge badge-info">{d.type || 'Other'}</span>
                </td>
                <td><strong>{d.name}</strong></td>
                <td>{d.size ? `${(d.size / 1024).toFixed(1)} KB` : '-'}</td>
                <td style={{ fontSize: 12, color: 'var(--text-soft)' }}>{new Date(d.uploaded_at).toLocaleDateString()}</td>
                <td>
                  <button className="btn btn-sm btn-secondary" onClick={() => download(d)} style={{ marginRight: 4 }}>Download</button>
                  {user.role === 'admin' && <button className="btn btn-sm btn-danger" onClick={() => del(d.id)}>Delete</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
