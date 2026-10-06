import React, { useEffect, useMemo, useState } from 'react';
import api from '../api';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const monthName = (m) => new Date(2000, m - 1, 1).toLocaleString('en', { month: 'long' });
const pad = (n) => String(n).padStart(2, '0');
// Show the person's given name — the first part of their email (e.g. rehan.feroz@ → Rehan).
const displayName = (l) => {
  const local = (l.email || '').split('@')[0];
  const first = local ? local.split('.')[0] : (l.employee_name || '').split(' ')[0];
  return first ? first.charAt(0).toUpperCase() + first.slice(1) : '?';
};

export default function LeaveCalendar() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState({ leaves: [], holidays: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get(`/leaves/calendar?month=${month}&year=${year}`).then(r => setData(r.data)).finally(() => setLoading(false));
  }, [month, year]);

  const prev = () => { if (month === 1) { setMonth(12); setYear(year - 1); } else setMonth(month - 1); };
  const next = () => { if (month === 12) { setMonth(1); setYear(year + 1); } else setMonth(month + 1); };

  const cells = useMemo(() => {
    const firstDow = new Date(year, month - 1, 1).getDay();
    const days = new Date(year, month, 0).getDate();
    const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const list = [];
    for (let i = 0; i < firstDow; i++) list.push(null);
    for (let d = 1; d <= days; d++) {
      const dateStr = `${year}-${pad(month)}-${pad(d)}`;
      const dow = new Date(year, month - 1, d).getDay();
      const holidays = data.holidays.filter(h => h.date === dateStr);
      const leaves = data.leaves.filter(l => l.start_date <= dateStr && l.end_date >= dateStr);
      list.push({ d, dateStr, weekend: dow === 0 || dow === 6, isToday: dateStr === todayStr, holidays, leaves });
    }
    return list;
  }, [data, month, year]);

  return (
    <>
      <div className="page-hero hero-calendar">
        <div>
          <h2>Team Leave Calendar</h2>
          <p>See who's on leave and which holidays fall this month — plan coverage at a glance.</p>
        </div>
      </div>

      <div className="toolbar">
        <button className="btn btn-secondary btn-sm" onClick={prev}>← Prev</button>
        <strong style={{ fontSize: 16, minWidth: 150, textAlign: 'center' }}>{monthName(month)} {year}</strong>
        <button className="btn btn-secondary btn-sm" onClick={next}>Next →</button>
        <button className="btn btn-secondary btn-sm" onClick={() => { setMonth(now.getMonth() + 1); setYear(now.getFullYear()); }}>Today</button>
        <span style={{ marginLeft: 'auto', color: 'var(--text-soft)' }}>
          {data.leaves.length} leave{data.leaves.length !== 1 ? 's' : ''} · {data.holidays.length} holiday{data.holidays.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="card"><div className="card-body">
        {loading ? <div className="loader" /> : (
          <>
            <div className="lc-grid">
              {DOW.map(d => <div key={d} className="lc-dow">{d}</div>)}
              {cells.map((c, i) => c === null
                ? <div key={i} className="lc-cell empty" />
                : (
                  <div key={i} className={`lc-cell ${c.weekend ? 'weekend' : ''} ${c.isToday ? 'today' : ''}`}>
                    <div className="lc-date">{c.d}</div>
                    {c.holidays.map((h, k) => <div key={k} className="lc-holiday" title={h.name}>🎉 {h.name}</div>)}
                    {c.leaves.slice(0, 3).map((l, k) => (
                      <div key={k} className={`lc-leave lc-${(l.code || '').toLowerCase()}`} title={`${l.employee_name} — ${l.leave_type}`}>{displayName(l)}</div>
                    ))}
                    {c.leaves.length > 3 && <div className="lc-more">+{c.leaves.length - 3} more</div>}
                  </div>
                ))}
            </div>
            <div className="lc-legend">
              <span><span className="lc-swatch" style={{ background: '#e6f1fb', border: '1px solid #bfdbfe' }} />Casual</span>
              <span><span className="lc-swatch" style={{ background: '#fef2f2', border: '1px solid #fecaca' }} />Sick</span>
              <span><span className="lc-swatch" style={{ background: '#ecfdf5', border: '1px solid #a7f3d0' }} />Earned</span>
              <span><span className="lc-swatch" style={{ background: '#f5f3ff', border: '1px solid #ddd6fe' }} />WFH</span>
              <span><span className="lc-swatch" style={{ background: '#fff7ed', border: '1px solid #fed7aa' }} />Holiday</span>
              <span><span className="lc-swatch" style={{ background: 'var(--surface-alt)', border: '1px solid var(--border)' }} />Weekend</span>
            </div>
          </>
        )}
      </div></div>
    </>
  );
}
