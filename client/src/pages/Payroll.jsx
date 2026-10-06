import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import api from '../api';

const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');
const monthName = (m) => new Date(2000, m - 1, 1).toLocaleString('en', { month: 'long' });
const daysIn = (m, y) => new Date(y, m, 0).getDate();

export default function Payroll() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [daysInMonth, setDaysInMonth] = useState(daysIn(now.getMonth() + 1, now.getFullYear()));
  const [sheet, setSheet] = useState([]);
  const [attended, setAttended] = useState({});
  const [sent, setSent] = useState({});
  const [sendingId, setSendingId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [preview, setPreview] = useState(null); // { id, left, top }

  const loadSheet = () => api.get(`/payroll/run-sheet?year=${year}`).then(r => {
    setSheet(r.data);
    setAttended(prev => {
      const next = { ...prev };
      r.data.forEach(e => { if (next[e.id] == null) next[e.id] = daysInMonth; });
      return next;
    });
  });

  useEffect(() => { loadSheet(); }, [year]);
  useEffect(() => { setDaysInMonth(daysIn(month, year)); setSent({}); }, [month, year]);

  const calc = (e) => {
    const att = Math.max(0, Math.min(daysInMonth, Number(attended[e.id] ?? daysInMonth)));
    const lopDays = Math.max(0, daysInMonth - att);
    const lopAmount = daysInMonth > 0 ? Math.round(e.gross * lopDays / daysInMonth) : 0;
    const pt = Math.min(200, e.deductions);
    const epf = Math.max(0, e.deductions - pt);
    const totalDed = e.deductions + lopAmount;
    const net = e.gross - totalDed;
    return { att, lopDays, lopAmount, pt, epf, totalDed, net };
  };

  const setAtt = (id, v) => setAttended(prev => ({ ...prev, [id]: v }));

  const totalNet = sheet.reduce((s, e) => s + calc(e).net, 0);
  const totalLop = sheet.reduce((s, e) => s + calc(e).lopAmount, 0);

  const runFor = async (entries) => {
    const { data } = await api.post('/payroll/run', { month, year, daysInMonth, entries });
    return data.generated;
  };

  const sendOne = async (e) => {
    setSendingId(e.id);
    try {
      await runFor([{ employeeId: e.id, attendedDays: attended[e.id] ?? daysInMonth }]);
      setSent(prev => ({ ...prev, [e.id]: true }));
      setMsg(`✓ Payslip for ${monthName(month)} ${year} sent to ${e.name}.`);
    } catch (err) {
      setMsg(err.response?.data?.error || 'Failed to send payslip');
    } finally {
      setSendingId(null);
      setTimeout(() => setMsg(''), 5000);
    }
  };

  const sendAll = async () => {
    if (!window.confirm(`Generate & send payslips for ${monthName(month)} ${year} to all ${sheet.length} employees?`)) return;
    setBusy(true);
    try {
      const n = await runFor(sheet.map(e => ({ employeeId: e.id, attendedDays: attended[e.id] ?? daysInMonth })));
      const all = {}; sheet.forEach(e => { all[e.id] = true; });
      setSent(all);
      setMsg(`✓ ${n} payslips generated and sent to all employees.`);
    } catch (err) {
      setMsg(err.response?.data?.error || 'Failed to generate payroll');
    } finally {
      setBusy(false);
      setTimeout(() => setMsg(''), 6000);
    }
  };

  const showPreview = (e) => setPreview({ id: e.id });

  const pv = preview ? sheet.find(e => e.id === preview.id) : null;
  const pvc = pv ? calc(pv) : null;

  return (
    <>
      <div className="page-hero hero-payroll">
        <div>
          <h2>Run Payroll</h2>
          <p>Set each employee's attended days. Days beyond paid leave are deducted as Loss of Pay. Send payslips to one employee or everyone.</p>
        </div>
        <button className="btn btn-primary" onClick={sendAll} disabled={busy || sheet.length === 0}>
          {busy ? 'Generating…' : 'Generate & send to all'}
        </button>
      </div>

      {msg && <div className="success-msg">{msg}</div>}

      <div className="toolbar">
        <label>Month</label>
        <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
          {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{monthName(i + 1)}</option>)}
        </select>
        <label>Year</label>
        <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
          {[year - 1, year, year + 1].map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <label>Days in month</label>
        <input type="number" min="1" max="31" value={daysInMonth} style={{ width: 70 }}
          onChange={(e) => setDaysInMonth(Math.max(1, Math.min(31, Number(e.target.value) || 1)))} />
        <span style={{ marginLeft: 'auto', color: 'var(--text-soft)' }}>
          Total LOP: <strong style={{ color: 'var(--danger)' }}>{inr(totalLop)}</strong>
          &nbsp;·&nbsp; Total payout: <strong style={{ color: 'var(--primary-dark)' }}>{inr(totalNet)}</strong>
        </span>
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Monthly Gross</th>
              <th>Paid leave left</th>
              <th style={{ width: 130 }}>Days attended</th>
              <th>LOP days</th>
              <th>LOP deduction</th>
              <th>Net Pay</th>
              <th>Payslip</th>
            </tr>
          </thead>
          <tbody>
            {sheet.length === 0 && <tr><td colSpan="8" className="empty">Loading employees…</td></tr>}
            {sheet.map(e => {
              const c = calc(e);
              return (
                <tr key={e.id}>
                  <td>
                    <strong>{e.name}</strong>
                    <div style={{ fontSize: 11, color: 'var(--text-soft)' }}>{e.code} · {e.designation}</div>
                  </td>
                  <td>{inr(e.gross)}</td>
                  <td>
                    <span className={`badge ${e.paidLeaveLeft > 0 ? 'badge-success' : 'badge-danger'}`}>{e.paidLeaveLeft} left</span>
                  </td>
                  <td>
                    <input type="number" min="0" max={daysInMonth}
                      className="form-control" style={{ width: 90, padding: '7px 10px' }}
                      value={attended[e.id] ?? daysInMonth}
                      onChange={(ev) => setAtt(e.id, ev.target.value === '' ? '' : Math.max(0, Math.min(daysInMonth, Number(ev.target.value))))} />
                    <span style={{ fontSize: 11, color: 'var(--text-mute)' }}> / {daysInMonth}</span>
                  </td>
                  <td>{c.lopDays > 0 ? <span className="badge badge-warning">{c.lopDays}</span> : '—'}</td>
                  <td style={{ color: c.lopAmount > 0 ? 'var(--danger)' : 'var(--text-mute)' }}>
                    {c.lopAmount > 0 ? '− ' + inr(c.lopAmount) : '—'}
                  </td>
                  <td><strong style={{ color: 'var(--primary-dark)' }}>{inr(c.net)}</strong></td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button className="btn btn-sm btn-secondary"
                        onMouseEnter={() => showPreview(e)} onMouseLeave={() => setPreview(null)}
                        onFocus={() => showPreview(e)} onBlur={() => setPreview(null)}>
                        Preview
                      </button>
                      {sent[e.id]
                        ? <span className="sent-tag">✓ Sent</span>
                        : <button className="btn btn-sm btn-primary" onClick={() => sendOne(e)} disabled={sendingId === e.id}>
                            {sendingId === e.id ? 'Sending…' : 'Send'}
                          </button>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {pv && createPortal(
        <div className="pp-overlay">
          <div className="pp-card">
            <div className="pp-top">
              <img className="pp-logo" src="/logo.png" alt="iGenie Labs" />
              <div className="pp-period">Payslip · {monthName(month)} {year}</div>
            </div>
            <div className="pp-emp">
              <b>{pv.name}</b>
              <span>{pv.code} · {pv.designation}</span>
            </div>
            <div className="pp-grid">
              <div className="pp-col">
                <div className="pp-colhead">Earnings</div>
                <div className="pp-line"><span>Basic</span><span>{inr(pv.basic)}</span></div>
                <div className="pp-line"><span>House Rent Allowance</span><span>{inr(pv.hra)}</span></div>
                <div className="pp-line"><span>Special Allowance</span><span>{inr(pv.special)}</span></div>
                <div className="pp-line pp-foot"><span>Gross Earnings</span><span>{inr(pv.gross)}</span></div>
              </div>
              <div className="pp-col">
                <div className="pp-colhead">Deductions</div>
                <div className="pp-line"><span>EPF Contribution</span><span>{inr(pvc.epf)}</span></div>
                <div className="pp-line"><span>Professional Tax</span><span>{inr(pvc.pt)}</span></div>
                {pvc.lopAmount > 0 && <div className="pp-line lop"><span>Loss of Pay ({pvc.lopDays} day{pvc.lopDays === 1 ? '' : 's'})</span><span>− {inr(pvc.lopAmount)}</span></div>}
                <div className="pp-line pp-foot"><span>Total Deductions</span><span>{inr(pvc.totalDed)}</span></div>
              </div>
            </div>
            <div className="pp-net"><span>Net Take-Home</span><b>{inr(pvc.net)}</b></div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
