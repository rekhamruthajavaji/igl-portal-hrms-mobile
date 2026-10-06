import React, { useEffect, useState } from 'react';
import api from '../api';

export default function Organization() {
  const [depts, setDepts] = useState([]);
  const [teams, setTeams] = useState([]);
  const [emps, setEmps] = useState([]);
  const [showD, setShowD] = useState(false);
  const [showT, setShowT] = useState(false);
  const [deptForm, setDeptForm] = useState({});
  const [teamForm, setTeamForm] = useState({});

  const load = () => {
    api.get('/org/departments').then(r => setDepts(r.data));
    api.get('/org/teams').then(r => setTeams(r.data));
    api.get('/employees').then(r => setEmps(r.data));
  };
  useEffect(() => { load(); }, []);

  const saveDept = async (e) => { e.preventDefault(); await api.post('/org/departments', deptForm); setShowD(false); setDeptForm({}); load(); };
  const saveTeam = async (e) => { e.preventDefault(); await api.post('/org/teams', teamForm); setShowT(false); setTeamForm({}); load(); };
  const delDept = async (id) => { if (!window.confirm('Delete this department?')) return; await api.delete(`/org/departments/${id}`); load(); };
  const delTeam = async (id) => { if (!window.confirm('Delete this team?')) return; await api.delete(`/org/teams/${id}`); load(); };

  return (
    <>
      <div className="page-hero hero-organization">
        <div><h2>Organization</h2><p>Manage departments and teams across the company.</p></div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header">
            <h3>Departments ({depts.length})</h3>
            <button className="btn btn-sm btn-primary" onClick={() => setShowD(true)}>+ Add</button>
          </div>
          <table className="table">
            <thead><tr><th>Name</th><th>Description</th><th>People</th><th></th></tr></thead>
            <tbody>
              {depts.map(d => (
                <tr key={d.id}>
                  <td><strong>{d.name}</strong></td>
                  <td style={{ fontSize: 12, color: 'var(--text-soft)' }}>{d.description || '-'}</td>
                  <td><span className="badge badge-info">{d.employee_count}</span></td>
                  <td><button className="btn btn-sm btn-danger" onClick={() => delDept(d.id)}>Delete</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>Teams ({teams.length})</h3>
            <button className="btn btn-sm btn-primary" onClick={() => setShowT(true)}>+ Add</button>
          </div>
          <table className="table">
            <thead><tr><th>Team</th><th>Department</th><th>Manager</th><th>Members</th><th></th></tr></thead>
            <tbody>
              {teams.map(t => (
                <tr key={t.id}>
                  <td><strong>{t.name}</strong></td>
                  <td>{t.department_name || '-'}</td>
                  <td>{t.manager_name || '-'}</td>
                  <td><span className="badge badge-info">{t.member_count}</span></td>
                  <td><button className="btn btn-sm btn-danger" onClick={() => delTeam(t.id)}>Delete</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showD && (
        <div className="modal-overlay" onClick={() => setShowD(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header"><h3>New Department</h3><span className="close-btn" onClick={() => setShowD(false)}>×</span></div>
            <div className="modal-body">
              <form onSubmit={saveDept}>
                <div className="form-group"><label>Name *</label><input className="form-control" required value={deptForm.name || ''} onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })} /></div>
                <div className="form-group"><label>Description</label><textarea className="form-control" value={deptForm.description || ''} onChange={(e) => setDeptForm({ ...deptForm, description: e.target.value })} /></div>
                <button className="btn btn-primary btn-block" type="submit">Save</button>
              </form>
            </div>
          </div>
        </div>
      )}

      {showT && (
        <div className="modal-overlay" onClick={() => setShowT(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header"><h3>New Team</h3><span className="close-btn" onClick={() => setShowT(false)}>×</span></div>
            <div className="modal-body">
              <form onSubmit={saveTeam}>
                <div className="form-group"><label>Name *</label><input className="form-control" required value={teamForm.name || ''} onChange={(e) => setTeamForm({ ...teamForm, name: e.target.value })} /></div>
                <div className="form-group"><label>Department</label>
                  <select className="form-control" value={teamForm.department_id || ''} onChange={(e) => setTeamForm({ ...teamForm, department_id: e.target.value })}>
                    <option value="">-- Select --</option>
                    {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div className="form-group"><label>Manager</label>
                  <select className="form-control" value={teamForm.manager_id || ''} onChange={(e) => setTeamForm({ ...teamForm, manager_id: e.target.value })}>
                    <option value="">-- None --</option>
                    {emps.filter(e => e.role !== 'employee').map(e => <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}
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
