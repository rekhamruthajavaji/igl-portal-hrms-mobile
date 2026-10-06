import React, { useEffect, useState } from 'react';
import api from '../api';
import '../styles/payslip.css';

const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const amt = (n) => (!n ? '-' : inr(n)); // dash for a zero monthly amount, like the sample slip

export default function Payslips() {
  const [rows, setRows] = useState([]);
  const [slip, setSlip] = useState(null);
  const [slipId, setSlipId] = useState(null);
  const [loadingSlip, setLoadingSlip] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => { api.get('/payroll').then(r => setRows(r.data)); }, []);

  const view = async (id) => {
    setLoadingSlip(true);
    setSlip({});
    setSlipId(id);
    try {
      const { data } = await api.get(`/payroll/${id}/payslip-data`);
      setSlip(data);
    } finally {
      setLoadingSlip(false);
    }
  };

  const month = (m) => new Date(2000, m - 1, 1).toLocaleString('en', { month: 'long' });

  // Download the payslip as a PDF file directly (no print dialog).
  const downloadSlip = async (id = slipId) => {
    if (!id) return;
    setDownloading(true);
    try {
      const r = await api.get(`/payroll/${id}/payslip`, { responseType: 'blob' });
      const label = slip?.period ? `${slip.employee?.code}-${slip.period.monthName}-${slip.period.year}` : id;
      const url = window.URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `Payslip-${label}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <>
      <div className="page-hero hero-payslips">
        <div><h2>My Payslips</h2><p>View and download your monthly salary slips.</p></div>
      </div>

      <div className="card">
        <table className="table">
          <thead><tr><th>Period</th><th>Basic</th><th>HRA</th><th>Allowances</th><th>Deductions</th><th>Net Pay</th><th>Generated</th><th></th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan="8" className="empty">No payslips available yet</td></tr>}
            {rows.map(r => (
              <tr key={r.id}>
                <td><strong>{month(r.month)} {r.year}</strong></td>
                <td>{inr(r.basic)}</td>
                <td>{inr(r.hra)}</td>
                <td>{inr(r.allowances)}</td>
                <td>{inr(r.deductions)}</td>
                <td><strong style={{ color: 'var(--primary-dark)' }}>{inr(r.net_pay)}</strong></td>
                <td style={{ fontSize: 12, color: 'var(--text-soft)' }}>{new Date(r.generated_at).toLocaleDateString()}</td>
                <td><button className="btn btn-sm btn-primary" onClick={() => view(r.id)}>View payslip</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {slip && (
        <div className="modal-overlay" onClick={() => setSlip(null)}>
          <div className="payslip-modal" onClick={(e) => e.stopPropagation()}>
            <div className="payslip-bar">
              <h3>Payslip{slip.period ? ` · ${slip.period.label}` : ''}</h3>
              <div className="actions">
                <button className="btn btn-sm btn-primary" disabled={loadingSlip || !slip.period || downloading} onClick={() => downloadSlip()}>{downloading ? 'Downloading…' : 'Download PDF'}</button>
                <button className="btn btn-sm btn-secondary" onClick={() => setSlip(null)}>Close</button>
              </div>
            </div>

            {loadingSlip || !slip.period ? <div className="loader" /> : <PayslipDoc data={slip} />}
          </div>
        </div>
      )}
    </>
  );
}

function PayslipDoc({ data }) {
  const { company, period, employee, summary, earnings, deductions, totals } = data;
  const rowCount = Math.max(earnings.length, deductions.length);

  return (
    <div className="payslip">
      {/* Header */}
      <div className="ps-head">
        <div className="ps-brand">
          <img className="ps-logo-img" src="/logo.png" alt="iGenie Labs" />
          <div className="ps-company">
            <h1>{company.name}</h1>
            <p>{company.line1}</p>
            <p>{company.line2}</p>
          </div>
        </div>
        <div className="ps-period">
          <div className="lbl">Payslip For the Month</div>
          <div className="mon">{period.label}</div>
        </div>
      </div>

      <hr className="ps-rule" />

      {/* Employee summary */}
      <div className="ps-section-title">EMPLOYEE SUMMARY</div>
      <div className="ps-summary">
        <div className="ps-kv">
          <span className="k">Employee Name</span><span className="c">:</span><span className="v">{employee.name}</span>
          <span className="k">Designation</span><span className="c">:</span><span className="v">{employee.designation}</span>
          <span className="k">Employee ID</span><span className="c">:</span><span className="v">{employee.code}</span>
          <span className="k">Department</span><span className="c">:</span><span className="v">{employee.department}</span>
          <span className="k">Date of Joining</span><span className="c">:</span><span className="v">{employee.doj}</span>
          <span className="k">Pay Period</span><span className="c">:</span><span className="v">{period.label}</span>
          <span className="k">Pay Date</span><span className="c">:</span><span className="v">{period.payDate}</span>
        </div>
        <div className="ps-netbox">
          <div className="amt">{inr(summary.netPay)}</div>
          <div className="cap">Total Net Pay</div>
          <hr />
          <div className="nrow"><span className="k">Paid Days</span><span className="v">: {summary.paidDays}</span></div>
          <div className="nrow"><span className="k">LOP Days</span><span className="v">: {summary.lopDays}</span></div>
        </div>
      </div>

      {/* PF / UAN / Bank / PAN */}
      <hr className="ps-rule" />
      <div className="ps-idblock">
        <div className="ps-idrow"><span className="k">PF A/C Number</span><span className="c">:</span><span className="v">{employee.pf_no || '—'}</span></div>
        <div className="ps-idrow"><span className="k">UAN</span><span className="c">:</span><span className="v">{employee.uan || '—'}</span></div>
        <div className="ps-idrow"><span className="k">Bank Account No</span><span className="c">:</span><span className="v">{employee.bank_account || '—'}</span></div>
        <div className="ps-idrow"><span className="k">PAN</span><span className="c">:</span><span className="v">{employee.pan || '—'}</span></div>
      </div>

      {/* Earnings / Deductions */}
      <hr className="ps-rule" />
      <div className="ps-ed">
        <div className="ps-ed-col">
          <div className="ps-ed-head"><span>EARNINGS</span><span className="a">AMOUNT</span><span className="y">YTD</span></div>
          {Array.from({ length: rowCount }).map((_, i) => {
            const e = earnings[i];
            return (
              <div className="ps-ed-row" key={i}>
                <span className="lab">{e ? e.label : ''}</span>
                <span className="a">{e ? amt(e.amount) : ''}</span>
                <span className="y">{e ? inr(e.ytd) : ''}</span>
              </div>
            );
          })}
          <div className="ps-ed-foot"><span>Gross Earnings</span><span className="amt">{inr(totals.grossEarnings)}</span></div>
        </div>
        <div className="ps-ed-col">
          <div className="ps-ed-head"><span>DEDUCTIONS</span><span className="a">AMOUNT</span><span className="y">YTD</span></div>
          {Array.from({ length: rowCount }).map((_, i) => {
            const d = deductions[i];
            return (
              <div className="ps-ed-row" key={i}>
                <span className="lab">{d ? d.label : ''}</span>
                <span className="a">{d ? amt(d.amount) : ''}</span>
                <span className="y">{d ? inr(d.ytd) : ''}</span>
              </div>
            );
          })}
          <div className="ps-ed-foot"><span>Total Deductions</span><span className="amt">{inr(totals.totalDeductions)}</span></div>
        </div>
      </div>

      {/* Net payable */}
      <div className="ps-netpayable">
        <div className="left">
          <b>TOTAL NET PAYABLE</b>
          <span>Gross Earnings - Total Deductions</span>
        </div>
        <div className="right">{inr(totals.netPayable)}</div>
      </div>

      <div className="ps-words"><b>Amount In Words</b> : {totals.amountInWords}</div>

      <div className="ps-foot">This is a system-generated payslip and does not require a signature.</div>
    </div>
  );
}
