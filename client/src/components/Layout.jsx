import React, { useEffect, useState, useRef } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api';

const ROUTE_TITLES = {
  '/': 'Dashboard',
  '/profile': 'My Profile',
  '/employees': 'Employees',
  '/leaves': 'Leave Management',
  '/payroll': 'Payroll',
  '/payslips': 'My Payslips',
  '/holidays': 'Holidays',
  '/feedback': 'Performance Feedback',
  '/notifications': 'Notifications',
  '/documents': 'Documents',
  '/reports': 'Reports',
  '/organization': 'Organization',
  '/action-center': 'Action Center',
  '/tickets': 'Help Desk',
  '/access': 'Password Management',
  '/help': 'Website Help',
  '/leave-calendar': 'Team Leave Calendar',
  '/probation': 'Probation Completed',
  '/probation-letter': 'Confirmation Letter',
};

const Icon = ({ d }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="nav-icon"><path d={d} /></svg>
);

export default function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifs, setNotifs] = useState([]);
  const [actionCount, setActionCount] = useState(0);
  const [ticketCount, setTicketCount] = useState(0);
  const [pwReqCount, setPwReqCount] = useState(0);
  const [letterInfo, setLetterInfo] = useState({ total: 0, pending: 0 });
  const [bellAlert, setBellAlert] = useState(false);
  const prevUnreadRef = useRef(null);
  const alertTimerRef = useRef(null);
  const notifRef = useRef(null);

  const title = ROUTE_TITLES[location.pathname] ||
    (location.pathname.startsWith('/employees/') ? 'Employee Details' : 'HRMS Portal');

  const loadNotifs = async () => {
    try {
      const { data } = await api.get('/notifications');
      setNotifs(data);
      const c = data.filter(n => !n.is_read).length;
      setUnread(c);
      // When a NEW notification arrives, flash the bell for ~2s to pull the eye there.
      if (prevUnreadRef.current !== null && c > prevUnreadRef.current) {
        setBellAlert(true);
        clearTimeout(alertTimerRef.current);
        alertTimerRef.current = setTimeout(() => setBellAlert(false), 2000);
      }
      prevUnreadRef.current = c;
    } catch {}
  };

  const loadActionCount = async () => {
    if (user?.role !== 'manager') return;
    try {
      const { data } = await api.get('/manager/action-count');
      setActionCount(data.total || 0);
    } catch {}
  };

  const loadTicketCount = async () => {
    if (user?.role !== 'admin') return;
    try {
      const { data } = await api.get('/tickets/open-count');
      setTicketCount(data.count || 0);
    } catch {}
  };

  const loadPwReqCount = async () => {
    if (user?.role !== 'admin') return;
    try {
      const { data } = await api.get('/access/request-count');
      setPwReqCount(data.count || 0);
    } catch {}
  };

  const loadLetterInfo = async () => {
    if (!user?.employee) return; // admins without an employee profile have no letters
    try {
      const { data } = await api.get('/probation-letters/summary');
      setLetterInfo({ total: data.total || 0, pending: data.pending || 0 });
    } catch {}
  };

  useEffect(() => {
    loadNotifs();
    loadActionCount();
    loadTicketCount();
    loadPwReqCount();
    loadLetterInfo();
    // Poll so a notification arriving while the user sits on a page still triggers the bell.
    const id = setInterval(() => { loadNotifs(); loadActionCount(); loadTicketCount(); loadPwReqCount(); loadLetterInfo(); }, 15000);
    return () => { clearInterval(id); clearTimeout(alertTimerRef.current); };
  }, [location.pathname]);

  // Close the notifications dropdown when clicking anywhere outside it.
  useEffect(() => {
    if (!notifOpen) return;
    const onDocClick = (e) => { if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false); };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [notifOpen]);

  const handleNotif = async (n) => {
    if (!n.is_read) await api.post(`/notifications/${n.id}/read`);
    if (n.link) navigate(n.link);
    setNotifOpen(false);
    loadNotifs();
  };

  const markAllRead = async () => {
    await api.post('/notifications/read-all');
    loadNotifs();
  };

  const initials = user?.employee
    ? `${user.employee.first_name[0]}${user.employee.last_name[0]}`
    : user?.email?.[0]?.toUpperCase() || 'U';

  const isAdmin = user.role === 'admin';
  const isMgr = user.role === 'manager';

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand brand-logo-only">
          <img className="brand-logo-img" src="/logo.png" alt="iGenie Labs" />
          <div className="brand-sub">Human Resource Management</div>
        </div>
        <nav className="nav">
          <div className="nav-section">Main</div>
          <NavLink to="/" end><Icon d="M3 12L12 4l9 8v9a1 1 0 01-1 1h-5v-7H9v7H4a1 1 0 01-1-1z" />Dashboard</NavLink>
          <NavLink to="/profile"><Icon d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2 M12 11a4 4 0 100-8 4 4 0 000 8z" />My Profile</NavLink>
          <NavLink to="/tickets">
            <Icon d="M3 18v-6a9 9 0 0 1 18 0v6 M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3z M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
            <span style={{ flex: 1 }}>Help Desk</span>
            {isAdmin && ticketCount > 0 && <span className="nav-badge">{ticketCount}</span>}
          </NavLink>
          {isMgr && (
            <NavLink to="/action-center">
              <Icon d="M9 11l3 3L22 4 M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
              <span style={{ flex: 1 }}>Action Center</span>
              {actionCount > 0 && <span className="nav-badge">{actionCount}</span>}
            </NavLink>
          )}

          <div className="nav-section">Workspace</div>
          {(isAdmin || isMgr) && <NavLink to="/employees"><Icon d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2 M23 21v-2a4 4 0 00-3-3.87 M16 3.13a4 4 0 010 7.75 M9 11a4 4 0 100-8 4 4 0 000 8z" />Employees</NavLink>}
          <NavLink to="/leaves"><Icon d="M19 4H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2zM16 2v4 M8 2v4 M3 10h18" />Leaves</NavLink>
          <NavLink to="/leave-calendar"><Icon d="M19 4H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2zM16 2v4 M8 2v4 M3 10h18 M8 14h.01 M12 14h.01 M16 14h.01 M8 18h.01 M12 18h.01" />Leave Calendar</NavLink>
          <NavLink to="/holidays"><Icon d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0016.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 002 8.5c0 2.3 1.5 4.05 3 5.5l7 7z" />Holidays</NavLink>
          {(isAdmin || isMgr) && <NavLink to="/offboarding"><Icon d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4 M16 17l5-5-5-5 M21 12H9" />Off Boarding</NavLink>}

          <div className="nav-section">Payroll & Growth</div>
          {isAdmin && <NavLink to="/payroll"><Icon d="M12 1v22 M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />Payroll</NavLink>}
          <NavLink to="/payslips"><Icon d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8" />Payslips</NavLink>
          {letterInfo.total > 0 && (
            <NavLink to="/probation-letter">
              <Icon d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6 M9 15l2 2 4-4" />
              <span style={{ flex: 1 }}>Confirmation Letter</span>
              {letterInfo.pending > 0 && <span className="nav-badge">{letterInfo.pending}</span>}
            </NavLink>
          )}
          <NavLink to="/feedback"><Icon d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z" />Feedback</NavLink>
          <NavLink to="/documents"><Icon d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4 M7 10l5 5 5-5 M12 15V3" />Documents</NavLink>

          {(isAdmin || isMgr) && (<>
            <div className="nav-section">Admin</div>
            <NavLink to="/reports"><Icon d="M3 3v18h18 M18 17l-5-5-4 4-3-3" />Reports</NavLink>
            {isAdmin && <NavLink to="/organization"><Icon d="M3 21h18 M5 21V7l8-4v18 M19 21V11l-6-4" />Organization</NavLink>}
            {isAdmin && (
              <NavLink to="/access">
                <Icon d="M2 18v3c0 .6.4 1 1 1h4v-3h3v-3h2l1.4-1.4a6.5 6.5 0 1 0-4-4Z M16.5 7.5h.01" />
                <span style={{ flex: 1 }}>Password Mgmt</span>
                {pwReqCount > 0 && <span className="nav-badge">{pwReqCount}</span>}
              </NavLink>
            )}
            {isAdmin && <NavLink to="/probation"><Icon d="M9 11l3 3L22 4 M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />Probation</NavLink>}
          </>)}
        </nav>
        <div className="sidebar-foot">© {new Date().getFullYear()} IGL Portal</div>
      </aside>

      <div>
        <header className="topbar">
          <div>
            <h1>{title}</h1>
          </div>
          <div className="topbar-actions">
            <div className="bell" onClick={() => navigate('/help')} title="Website Help — step-by-step guides" style={{ position: 'relative' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" /><path d="M12 17h.01" /></svg>
            </div>
            {isAdmin && (
              <div className="bell" onClick={() => navigate('/access')} title="Password Management — reset employee passwords" style={{ position: 'relative' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 18v3c0 .6.4 1 1 1h4v-3h3v-3h2l1.4-1.4a6.5 6.5 0 1 0-4-4Z" /><path d="M16.5 7.5h.01" /></svg>
                {pwReqCount > 0 && <span className="bell-badge">{pwReqCount}</span>}
              </div>
            )}
            <div className="bell" onClick={() => navigate('/tickets')} title="Help Desk — raise or view tickets" style={{ position: 'relative' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6" /><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3z" /><path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" /></svg>
              {ticketCount > 0 && <span className="bell-badge">{ticketCount}</span>}
            </div>
            <div style={{ position: 'relative' }} ref={notifRef}>
              <div className={`bell${bellAlert ? ' bell-alert' : ''}`} onClick={() => setNotifOpen(!notifOpen)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9 M13.73 21a2 2 0 01-3.46 0" /></svg>
                {unread > 0 && <span className="bell-badge">{unread}</span>}
              </div>
              {notifOpen && (
                <div className="dropdown">
                  <div className="dropdown-header">
                    <h4>Notifications</h4>
                    {unread > 0 && <button className="btn btn-sm btn-secondary" onClick={markAllRead}>Mark all read</button>}
                  </div>
                  {notifs.length === 0 && <div className="empty">No notifications yet</div>}
                  {notifs.slice(0, 10).map(n => (
                    <div key={n.id} className={`dropdown-item ${!n.is_read ? 'unread' : ''}`} onClick={() => handleNotif(n)}>
                      <div className="dropdown-item-title">{n.title}</div>
                      {n.message && <div className="dropdown-item-msg">{n.message}</div>}
                      <div className="dropdown-item-time">{new Date(n.created_at).toLocaleString()}</div>
                    </div>
                  ))}
                  {notifs.length > 0 && (
                    <div className="dropdown-item" style={{ textAlign: 'center', cursor: 'pointer' }} onClick={() => { navigate('/notifications'); setNotifOpen(false); }}>
                      <strong style={{ color: 'var(--blue)' }}>View all notifications</strong>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="user-chip" onClick={() => navigate('/profile')}>
              <div className="user-info">
                <div className="name">{user?.employee ? `${user.employee.first_name} ${user.employee.last_name}` : user.email}</div>
                <div className="role">{user.role}</div>
              </div>
              <div className="avatar">{initials}</div>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => { logout(); navigate('/login'); }}>Log out</button>
          </div>
        </header>
        <main className="content"><div className="page-fade" key={location.pathname}><Outlet /></div></main>
      </div>
    </div>
  );
}
