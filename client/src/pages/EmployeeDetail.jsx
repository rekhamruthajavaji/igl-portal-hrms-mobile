import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';

export default function EmployeeDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [emp, setEmp] = useState(null);
  const [balances, setBalances] = useState([]);

  useEffect(() => {
    api.get(`/employees/${id}`).then(r => setEmp(r.data));
    api.get(`/leaves/balances?employee_id=${id}`).then(r => setBalances(r.data)).catch(() => {});
  }, [id]);

  if (!emp) return <div className="loader" />;

  return (
    <>
      <div className="profile-header">
        <div className="avatar avatar-lg">{emp.first_name[0]}{emp.last_name[0]}</div>
        <div style={{ flex: 1 }}>
          <h2>{emp.first_name} {emp.last_name}</h2>
          <div className="designation">{emp.designation || 'No designation'} · {emp.department_name || 'No department'}</div>
          <div style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>Code: {emp.employee_code} · {emp.email}</div>
        </div>
        <span className={`badge ${emp.employment_status === 'active' ? 'badge-success' : 'badge-default'}`}>{emp.employment_status}</span>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header"><h3>Personal Information</h3></div>
          <div className="card-body">
            <div className="info-grid">
              <div className="info-item"><label>Phone</label><div className="value">{emp.phone || '-'}</div></div>
              <div className="info-item"><label>Date of Birth</label><div className="value">{emp.dob || '-'}</div></div>
              <div className="info-item"><label>Gender</label><div className="value">{emp.gender || '-'}</div></div>
              <div className="info-item"><label>State</label><div className="value">{emp.state || '-'}</div></div>
              <div className="info-item" style={{ gridColumn: '1 / -1' }}><label>Address</label><div className="value">{emp.address || '-'}</div></div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h3>Employment</h3></div>
          <div className="card-body">
            <div className="info-grid">
              <div className="info-item"><label>Joining Date</label><div className="value">{emp.joining_date}</div></div>
              <div className="info-item"><label>Designation</label><div className="value">{emp.designation || '-'}</div></div>
              <div className="info-item"><label>Department</label><div className="value">{emp.department_name || '-'}</div></div>
              <div className="info-item"><label>Team</label><div className="value">{emp.team_name || '-'}</div></div>
              <div className="info-item"><label>Reports to</label><div className="value">{emp.manager_name || '-'}</div></div>
              <div className="info-item"><label>Role</label><div className="value" style={{ textTransform: 'capitalize' }}>{emp.role}</div></div>
            </div>
          </div>
        </div>
      </div>

      {user.role !== 'employee' && (
        <div className="grid-2" style={{ marginTop: 20 }}>
          <div className="card">
            <div className="card-header"><h3>Bank & Compensation</h3></div>
            <div className="card-body">
              <div className="info-grid">
                <div className="info-item"><label>Bank</label><div className="value">{emp.bank_name || '-'}</div></div>
                <div className="info-item"><label>Account</label><div className="value">{emp.bank_account || '-'}</div></div>
                <div className="info-item"><label>IFSC</label><div className="value">{emp.ifsc || '-'}</div></div>
                <div className="info-item"><label>PAN</label><div className="value">{emp.pan || '-'}</div></div>
                <div className="info-item"><label>Basic</label><div className="value">₹{emp.basic_salary?.toLocaleString('en-IN') || 0}</div></div>
                <div className="info-item"><label>HRA</label><div className="value">₹{emp.hra?.toLocaleString('en-IN') || 0}</div></div>
                <div className="info-item"><label>Allowances</label><div className="value">₹{emp.allowances?.toLocaleString('en-IN') || 0}</div></div>
                <div className="info-item"><label>Deductions</label><div className="value">₹{emp.deductions?.toLocaleString('en-IN') || 0}</div></div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header"><h3>Leave Balances ({new Date().getFullYear()})</h3></div>
            <div className="card-body">
              {balances.length === 0 && <div className="empty">No balances yet</div>}
              {balances.map(b => {
                const remaining = b.total - b.used;
                const pct = b.total > 0 ? (b.used / b.total) * 100 : 0;
                return (
                  <div key={b.id} className="balance-row">
                    <div className="balance-head">
                      <strong>{b.leave_type_name}</strong>
                      <span><b>{remaining.toFixed(1)}</b> / {b.total} days</span>
                    </div>
                    <div className="balance-bar"><div className="balance-bar-fill" style={{ width: `${pct}%` }} /></div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
