import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/landing.css';

export default function Landing() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('admin@igenielabs.com');
  const [password, setPassword] = useState('Admin@123');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Logged-in visitors skip the marketing page and go straight to their dashboard.
  if (user) return <Navigate to="/" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Sign in failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const setDemo = (em, pw) => { setEmail(em); setPassword(pw); setError(''); };

  return (
    <div className="landing">
      <nav>
        <div className="wrap nav-in">
          <div className="brand">HRMS</div>
          <div className="nav-links">
            <a href="#roles">For your role</a>
            <a href="#flow">How it works</a>
            <a href="#stats">Why it helps</a>
          </div>
        </div>
      </nav>

      <header className="hero">
        <div className="wrap hero-grid">
          <div>
            <div className="pill"><span className="dot"></span> One login · three views</div>
            <h1>One portal for<br /><span className="hl">your whole company.</span></h1>
            <p className="lede">Employees, managers and HR sign in to the same place — and each sees exactly what their job needs. Request, approve, and run it all without leaving HRMS.</p>
            <div className="hero-actions">
              <a href="#signin" className="btn btn-primary">Sign in to your portal</a>
              <a href="#roles" className="btn btn-ghost">See your role</a>
              <span className="note">Your view loads automatically after sign-in</span>
            </div>
          </div>

          <form className="signcard" id="signin" onSubmit={submit}>
            <div className="signcard-head">
              <div className="sc-brand">HRMS</div>
              <div className="avatar">
                <svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 4-6 8-6s8 2 8 6" /></svg>
              </div>
              <div className="sc-title">Sign In</div>
              <div className="sc-title-rule"></div>
            </div>
            <div className="signcard-body">
              {error && <div className="sc-error">{error}</div>}
              <div className="field">
                <svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email"
                  autoComplete="username"
                  required
                />
              </div>
              <div className="field">
                <svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  autoComplete="current-password"
                  required
                />
                <span className="show" role="button" tabIndex={0} onClick={() => setShowPwd(!showPwd)}>{showPwd ? 'Hide' : 'Show'}</span>
              </div>
              <button type="submit" className="btn btn-primary sc-btn" disabled={loading}>
                {loading ? 'Signing In…' : 'Sign In'}
              </button>
              <a href="#signin" className="sc-forgot" onClick={(e) => e.preventDefault()}>Forgot Password?</a>
              <div className="sc-roles">
                <span onClick={() => setDemo('employee@igenielabs.com', 'Employee@123')}>Employee</span>
                <span onClick={() => setDemo('manager@igenielabs.com', 'Manager@123')}>Manager</span>
                <span onClick={() => setDemo('admin@igenielabs.com', 'Admin@123')}>HR</span>
              </div>
            </div>
          </form>
        </div>
      </header>

      <div className="wrap">
        <div className="strip strip-in">
          <span className="lbl">One system across</span>
          <div className="names">
            <span>Engineering</span>
            <span>Sales</span>
            <span>Finance</span>
            <span>Operations</span>
            <span>People &amp; HR</span>
          </div>
        </div>
      </div>

      <section className="block" id="roles">
        <div className="wrap">
          <div className="sec-top">
            <span className="kicker">For your role</span>
            <h2>Same login. The view that fits the job.</h2>
            <p>HRMS knows who you are when you sign in. Here's what each role gets the moment the dashboard loads.</p>
          </div>
          <div className="roles">

            <div className="role emp">
              <div className="role-top">
                <div className="role-ic"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 4-6 8-6s8 2 8 6" /></svg></div>
                <div><h3>Employee</h3><div className="who">Your own workday</div></div>
              </div>
              <ul>
                <li><span className="tick"><svg viewBox="0 0 24 24"><path d="m4 12 5 5L20 6" /></svg></span>Apply for leave and track approvals</li>
                <li><span className="tick"><svg viewBox="0 0 24 24"><path d="m4 12 5 5L20 6" /></svg></span>Download payslips and tax documents</li>
                <li><span className="tick"><svg viewBox="0 0 24 24"><path d="m4 12 5 5L20 6" /></svg></span>Clock in, log hours, and view attendance</li>
                <li><span className="tick"><svg viewBox="0 0 24 24"><path d="m4 12 5 5L20 6" /></svg></span>Update personal details and bank info</li>
                <li><span className="tick"><svg viewBox="0 0 24 24"><path d="m4 12 5 5L20 6" /></svg></span>Find colleagues in the team directory</li>
              </ul>
            </div>

            <div className="role mgr">
              <div className="role-top">
                <div className="role-ic"><svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3" /><path d="M3 19c0-3 2.5-5 6-5s6 2 6 5" /><path d="M16 8h5M18.5 5.5v5" /></svg></div>
                <div><h3>Manager</h3><div className="who">Your team</div></div>
              </div>
              <ul>
                <li><span className="tick"><svg viewBox="0 0 24 24"><path d="m4 12 5 5L20 6" /></svg></span>Approve or decline leave in one tap</li>
                <li><span className="tick"><svg viewBox="0 0 24 24"><path d="m4 12 5 5L20 6" /></svg></span>Review and correct team timesheets</li>
                <li><span className="tick"><svg viewBox="0 0 24 24"><path d="m4 12 5 5L20 6" /></svg></span>See who's in, off, or on leave today</li>
                <li><span className="tick"><svg viewBox="0 0 24 24"><path d="m4 12 5 5L20 6" /></svg></span>Track pending requests across the team</li>
                <li><span className="tick"><svg viewBox="0 0 24 24"><path d="m4 12 5 5L20 6" /></svg></span>Get notified when something needs you</li>
              </ul>
            </div>

            <div className="role hr">
              <div className="role-top">
                <div className="role-ic"><svg viewBox="0 0 24 24"><path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7z" /><path d="m9 12 2 2 4-4" /></svg></div>
                <div><h3>HR</h3><div className="who">The whole org</div></div>
              </div>
              <ul>
                <li><span className="tick"><svg viewBox="0 0 24 24"><path d="m4 12 5 5L20 6" /></svg></span>Run payroll and release payslips</li>
                <li><span className="tick"><svg viewBox="0 0 24 24"><path d="m4 12 5 5L20 6" /></svg></span>Manage employee records and onboarding</li>
                <li><span className="tick"><svg viewBox="0 0 24 24"><path d="m4 12 5 5L20 6" /></svg></span>Set leave policies and holiday calendars</li>
                <li><span className="tick"><svg viewBox="0 0 24 24"><path d="m4 12 5 5L20 6" /></svg></span>Pull reports on attendance and headcount</li>
                <li><span className="tick"><svg viewBox="0 0 24 24"><path d="m4 12 5 5L20 6" /></svg></span>Control access and roles across the org</li>
              </ul>
            </div>

          </div>
        </div>
      </section>

      <section className="block" id="flow" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="band">
            <div className="band-top">
              <span className="kicker">How it works</span>
              <h2>One request, handled end to end.</h2>
              <p>The same leave request moves through all three roles without a single email. Everyone sees the same status.</p>
            </div>
            <div className="flow">
              <div className="fstep">
                <div className="stepno">STEP 01</div>
                <div className="role-tag">Employee</div>
                <b>Requests leave</b>
                <p>Files three days off, sees the balance update, and the request routes to the right manager automatically.</p>
              </div>
              <div className="fstep">
                <div className="stepno">STEP 02</div>
                <div className="role-tag">Manager</div>
                <b>Approves it</b>
                <p>Gets a notification, checks team coverage in the same view, and approves in one tap — or asks a question inline.</p>
              </div>
              <div className="fstep">
                <div className="stepno">STEP 03</div>
                <div className="role-tag">HR</div>
                <b>It's recorded</b>
                <p>The approved leave lands in records and payroll automatically. No re-entry, no spreadsheet, no chasing.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="block" id="stats" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="sec-top">
            <span className="kicker">Why it helps</span>
            <h2>Less back-and-forth. For everyone.</h2>
          </div>
          <div className="stats">
            <div className="stat"><div className="n">1</div><div className="l">login for all three roles</div></div>
            <div className="stat"><div className="n">3</div><div className="l">tailored dashboards</div></div>
            <div className="stat"><div className="n">0</div><div className="l">emails to route a request</div></div>
            <div className="stat"><div className="n">24/7</div><div className="l">access from any device</div></div>
          </div>
        </div>
      </section>

      <section className="cta">
        <div className="wrap">
          <div className="cta-box">
            <h2>Sign in and see your view.</h2>
            <p>Whether you're requesting, approving, or running it all — your dashboard is waiting behind one login.</p>
            <a href="#signin" className="btn btn-white">Sign in to HRMS</a>
          </div>
        </div>
      </section>

      <footer>
        <div className="wrap foot-in">
          <span className="brand">HRMS</span>
          <span>© 2026 iGenie Labs · One portal for employees, managers &amp; HR</span>
        </div>
      </footer>
    </div>
  );
}
