import React, { useEffect, useState } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';

const STATES = [
  { code: 'AP', name: 'Andhra Pradesh' },
  { code: 'TS', name: 'Telangana' },
  { code: 'DEL', name: 'New Delhi' },
];
const STATE_NAME = { AP: 'Andhra Pradesh', TS: 'Telangana', DEL: 'New Delhi' };

export default function Holidays() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [stateFilter, setStateFilter] = useState('');
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({});

  const load = () => {
    const q = new URLSearchParams({ year: String(year) });
    if (stateFilter) q.set('state', stateFilter);
    api.get(`/holidays?${q.toString()}`).then(r => setRows(r.data));
  };
  useEffect(() => { load(); }, [year, stateFilter]);

  const save = async (e) => {
    e.preventDefault();
    await api.post('/holidays', form);
    setShow(false);
    setForm({});
    load();
  };
  const del = async (id) => {
    if (!window.confirm('Delete this holiday?')) return;
    await api.delete(`/holidays/${id}`);
    load();
  };

  return (
    <>
      <div className="page-hero hero-holidays">
        <div><h2>Holiday Calendar</h2><p>State-specific holidays for {year}. Employees see holidays applicable to their work location.</p></div>
        {user.role === 'admin' && <button className="btn btn-primary" onClick={() => setShow(true)}>+ Add Holiday</button>}
      </div>

      <div className="toolbar">
        <label>Year:</label>
        <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
          {[year-1, year, year+1].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <label>Location:</label>
        <select value={stateFilter} onChange={(e) => setStateFilter(e.target.value)}>
          <option value="">My location</option>
          {STATES.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
        </select>
        <span style={{ marginLeft: 'auto', color: 'var(--text-soft)' }}>{rows.length} holidays</span>
      </div>

      <div className="holiday-list">
        {rows.length === 0 && <div className="empty" style={{ gridColumn: '1 / -1' }}>No holidays for this selection</div>}
        {rows.map(h => {
          const d = new Date(h.date);
          return (
            <div key={h.id} className="holiday-card">
              <div className="holiday-date">
                <div className="day">{d.getDate()}</div>
                <div className="month">{d.toLocaleString('en', { month: 'short' })}</div>
              </div>
              <div className="holiday-info" style={{ flex: 1 }}>
                <h4>{h.name}</h4>
                <p>{d.toLocaleDateString('en-US', { weekday: 'long' })} · {STATE_NAME[h.state] || h.state}</p>
              </div>
              {user.role === 'admin' && <button className="btn btn-sm btn-secondary" onClick={() => del(h.id)}>Delete</button>}
            </div>
          );
        })}
      </div>

      {show && (
        <div className="modal-overlay" onClick={() => setShow(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header"><h3>Add Holiday</h3><span className="close-btn" onClick={() => setShow(false)}>×</span></div>
            <div className="modal-body">
              <form onSubmit={save}>
                <div className="form-group"><label>Holiday Name *</label><input className="form-control" required value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div className="form-group"><label>Date *</label><input type="date" className="form-control" required value={form.date || ''} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
                <div className="form-group"><label>Location</label>
                  <select className="form-control" value={form.state || 'AP'} onChange={(e) => setForm({ ...form, state: e.target.value })}>
                    {STATES.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
                  </select>
                </div>
                <button className="btn btn-primary btn-block" type="submit">Save</button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
