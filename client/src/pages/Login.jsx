import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api';

export default function Login() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('praneel.peruru@libraryone.com');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Forgot-password modal
  const [fpOpen, setFpOpen] = useState(false);
  const [fp, setFp] = useState({ email: '', newPassword: '', confirm: '' });
  const [fpMsg, setFpMsg] = useState({ type: '', text: '' });
  const [fpBusy, setFpBusy] = useState(false);

  const submitForgot = async (e) => {
    e.preventDefault();
    setFpMsg({});
    if (fp.newPassword.length < 6) { setFpMsg({ type: 'error', text: 'Password must be at least 6 characters' }); return; }
    if (fp.newPassword !== fp.confirm) { setFpMsg({ type: 'error', text: 'Passwords do not match' }); return; }
    setFpBusy(true);
    try {
      await api.post('/auth/forgot-password', { email: fp.email, newPassword: fp.newPassword });
      setFpMsg({ type: 'success', text: '✓ Password updated. You can now sign in with it.' });
      setFp({ email: '', newPassword: '', confirm: '' });
      setTimeout(() => { setFpOpen(false); setFpMsg({}); }, 1800);
    } catch (err) {
      setFpMsg({ type: 'error', text: err.response?.data?.error || 'Could not reset password' });
    } finally {
      setFpBusy(false);
    }
  };

  useEffect(() => { if (user) navigate('/'); }, [user]);

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
    <div className="signin-page">
      <div className="signin-card">
        {/* ── Left: form ── */}
        <div className="signin-left">
          <img className="signin-brand-logo" src="/logo.png" alt="iGenie Labs" />

          <div className="signin-avatar" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21c0-4 3.6-6 8-6s8 2 8 6" />
            </svg>
          </div>

          <h2 className="signin-title">Sign In</h2>

          {error && <div className="signin-error">{error}</div>}

          <form onSubmit={submit} className="signin-form">
            <div className="signin-field">
              <span className="signin-ico">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="5" width="18" height="14" rx="2" />
                  <path d="m3 7 9 6 9-6" />
                </svg>
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                autoComplete="username"
                required
              />
            </div>

            <div className="signin-field">
              <span className="signin-ico">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="4" y="11" width="16" height="10" rx="2" />
                  <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                </svg>
              </span>
              <input
                type={showPwd ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                autoComplete="current-password"
                required
              />
              <button type="button" className="signin-eye" onClick={() => setShowPwd(!showPwd)} aria-label={showPwd ? 'Hide password' : 'Show password'}>
                {showPwd ? 'Hide' : 'Show'}
              </button>
            </div>

            <button className="signin-btn" type="submit" disabled={loading}>
              {loading ? 'Signing In…' : 'Sign In'}
            </button>
          </form>

          <button type="button" className="signin-forgot" onClick={() => { setFp({ email: '', newPassword: '', confirm: '' }); setFpMsg({}); setFpOpen(true); }}>Forgot Password ?</button>

          <div className="signin-demo">
            <span className="signin-demo-label">Quick sign-in</span>
            <div className="signin-demo-row">
              <button type="button" onClick={() => setDemo('praneel.peruru@libraryone.com', 'Admin@123')}>Admin</button>
              <button type="button" onClick={() => setDemo('rehan.feroz@libraryone.com', 'RehanFeroz@04')}>Employee</button>
            </div>
          </div>
        </div>

        {/* ── Right: illustration ── */}
        <div className="signin-right" aria-hidden="true">
          <svg className="signin-art" viewBox="0 0 420 380" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* dashboard board */}
            <rect x="150" y="70" width="230" height="150" rx="12" fill="#ffffff" />
            <rect x="150" y="70" width="230" height="34" rx="12" fill="#3d4ee8" />
            <rect x="150" y="92" width="230" height="12" fill="#3d4ee8" />
            <circle cx="167" cy="87" r="5" fill="#fff" opacity="0.9" />
            <circle cx="183" cy="87" r="5" fill="#fff" opacity="0.7" />
            {/* bar chart */}
            <rect x="170" y="170" width="16" height="30" rx="3" fill="#aab2f7" />
            <rect x="194" y="150" width="16" height="50" rx="3" fill="#7782f3" />
            <rect x="218" y="135" width="16" height="65" rx="3" fill="#3d4ee8" />
            {/* checklist */}
            <rect x="258" y="128" width="100" height="10" rx="5" fill="#dfe3fd" />
            <rect x="258" y="150" width="80" height="10" rx="5" fill="#dfe3fd" />
            <rect x="258" y="172" width="92" height="10" rx="5" fill="#dfe3fd" />
            <circle cx="368" cy="133" r="8" fill="#34c759" />
            <path d="m364 133 3 3 5-6" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="348" cy="155" r="8" fill="#34c759" />
            <path d="m344 155 3 3 5-6" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />

            {/* gear */}
            <g transform="translate(330 70)">
              <circle r="22" fill="#3d4ee8" />
              <circle r="9" fill="#fff" />
              {[0, 45, 90, 135, 180, 225, 270, 315].map((d) => (
                <rect key={d} x="-4" y="-26" width="8" height="9" rx="2" fill="#3d4ee8" transform={`rotate(${d})`} />
              ))}
            </g>

            {/* person — presenter (left) */}
            <g transform="translate(70 150)">
              <circle cx="0" cy="0" r="20" fill="#7782f3" />
              <path d="M-24 78c0-26 11-40 24-40s24 14 24 40z" fill="#3f4a6b" />
              <rect x="-2" y="18" width="4" height="40" fill="#3f4a6b" />
            </g>

            {/* person — sitting (bottom right) */}
            <g transform="translate(300 250)">
              <circle cx="0" cy="0" r="18" fill="#3d4ee8" />
              <path d="M-22 64c0-22 10-34 22-34s22 12 22 34z" fill="#4a5578" />
            </g>

            {/* ground */}
            <ellipse cx="210" cy="330" rx="170" ry="16" fill="#3d4ee8" opacity="0.12" />
            <rect x="60" y="318" width="300" height="6" rx="3" fill="#3d4ee8" opacity="0.25" />
          </svg>
        </div>
      </div>

      {fpOpen && (
        <div className="modal-overlay" onClick={() => setFpOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div className="modal-header"><h3>Reset your password</h3><span className="close-btn" onClick={() => setFpOpen(false)}>×</span></div>
            <div className="modal-body">
              <p style={{ fontSize: 13, color: 'var(--text-soft)', marginTop: 0 }}>Enter your work email and choose a new password.</p>
              {fpMsg.type === 'error' && <div className="error-msg">{fpMsg.text}</div>}
              {fpMsg.type === 'success' && <div className="success-msg">{fpMsg.text}</div>}
              <form onSubmit={submitForgot}>
                <div className="form-group"><label>Email</label><input type="email" className="form-control" required value={fp.email} onChange={(e) => setFp({ ...fp, email: e.target.value })} placeholder="you@libraryone.com" autoFocus /></div>
                <div className="form-group"><label>New Password</label><input type="password" className="form-control" required value={fp.newPassword} onChange={(e) => setFp({ ...fp, newPassword: e.target.value })} placeholder="At least 6 characters" /></div>
                <div className="form-group"><label>Confirm New Password</label><input type="password" className="form-control" required value={fp.confirm} onChange={(e) => setFp({ ...fp, confirm: e.target.value })} /></div>
                <button className="btn btn-primary btn-block" type="submit" disabled={fpBusy}>{fpBusy ? 'Updating…' : 'Update Password'}</button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
