import React, { useEffect, useState } from 'react';
import api from '../api';

const initials = (name) => name.split(' ').map(w => w[0]).slice(0, 2).join('');
const fmt = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

export default function Probation() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(null); // employee id currently sending
  const [emailing, setEmailing] = useState(null); // employee id currently emailing
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api.get('/employees/probation').then(r => setRows(r.data)).finally(() => setLoading(false));
  }, []);

  const sendLetter = async (emp) => {
    if (sending) return;
    setSending(emp.id);
    setMsg('');
    try {
      // Deliver the letter to the employee's Documents + notification for them to review and sign.
      await api.post(`/employees/probation/${emp.id}/send-letter`);
      setRows(prev => prev.map(r => r.id === emp.id ? { ...r, letter_sent: true, letter_status: 'pending' } : r));
      setMsg(`Probation confirmation letter sent to ${emp.name}. They'll be asked to review and sign it.`);
      setTimeout(() => setMsg(''), 6000);
    } catch (e) {
      setMsg(e.response?.data?.error || 'Could not send the letter. Please try again.');
      setTimeout(() => setMsg(''), 6000);
    } finally {
      setSending(null);
    }
  };

  // Admin emails the signed letter (PDF) to the employee + admins.
  const emailLetter = async (emp) => {
    if (emailing || !emp.letter_id) return;
    setEmailing(emp.id);
    setMsg('');
    try {
      const { data } = await api.post(`/probation-letters/${emp.letter_id}/email`);
      setRows(prev => prev.map(r => r.id === emp.id ? { ...r, letter_emailed_at: data.emailedAt || new Date().toISOString() } : r));
      setMsg(`Signed letter emailed to: ${(data.recipients || []).join(', ')}`);
      setTimeout(() => setMsg(''), 8000);
    } catch (e) {
      setMsg(e.response?.data?.error || 'Could not send the email. Please try again.');
      setTimeout(() => setMsg(''), 8000);
    } finally {
      setEmailing(null);
    }
  };

  return (
    <>
      <div className="page-hero hero-organization">
        <div>
          <h2>Probation Completed</h2>
          <p>Employees who have completed 6 months since their joining date and are eligible for confirmation.</p>
        </div>
        <span style={{ fontSize: 28, fontWeight: 800 }}>{rows.length}</span>
      </div>

      {msg && <div className="success-msg">{msg}</div>}

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Designation</th>
              <th>Department</th>
              <th>Joining Date</th>
              <th>6 Months Completed On</th>
              <th>Tenure</th>
              <th>Confirmation Letter</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan="7"><div className="loader" /></td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan="7" className="empty">No employee has completed 6 months yet.</td></tr>}
            {rows.map(r => (
              <tr key={r.id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div className="avatar" style={{ width: 32, height: 32, fontSize: 12 }}>{initials(r.name)}</div>
                    <div>
                      <strong>{r.name}</strong>
                      <div style={{ fontSize: 11, color: 'var(--text-mute)' }}>{r.code}</div>
                    </div>
                  </div>
                </td>
                <td>{r.designation}</td>
                <td>{r.department}</td>
                <td>{fmt(r.joining_date)}</td>
                <td><span className="badge badge-success">{fmt(r.completed_on)}</span></td>
                <td>{r.months} month{r.months === 1 ? '' : 's'}</td>
                <td>
                  {r.letter_status === 'signed' ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span className="badge badge-success">✓ Signed {fmt(r.letter_signed_at)}</span>
                      {r.email_enabled && (
                        <button
                          className={`btn btn-sm ${r.letter_emailed_at ? 'btn-secondary' : 'btn-primary'}`}
                          disabled={emailing === r.id}
                          onClick={() => emailLetter(r)}
                          title="Email the signed letter (PDF) to the employee and admins"
                        >
                          {emailing === r.id ? 'Sending…' : r.letter_emailed_at ? '✓ Emailed · Resend' : 'Send to Mail'}
                        </button>
                      )}
                    </div>
                  ) : r.letter_status === 'pending' ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span className="badge badge-warning">Sent · awaiting signature</span>
                      <button className="btn btn-sm btn-secondary" disabled={sending === r.id} onClick={() => sendLetter(r)}>
                        {sending === r.id ? 'Sending…' : 'Resend'}
                      </button>
                    </div>
                  ) : (
                    <button
                      className="btn btn-sm btn-primary"
                      disabled={sending === r.id}
                      onClick={() => sendLetter(r)}
                      title="Send the confirmation letter to this employee to review and sign"
                    >
                      {sending === r.id ? 'Sending…' : 'Send'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
