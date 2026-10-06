import React, { useState } from 'react';

const Icon = ({ d }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
);

const GUIDES = [
  {
    title: 'Apply for leave',
    sub: 'Request time off and track its approval',
    color: 'linear-gradient(135deg,#4f46e5,#7c3aed)',
    icon: 'M19 4H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2zM16 2v4 M8 2v4 M3 10h18',
    steps: [
      { label: 'Open Leaves', desc: 'Click "Leaves" in the sidebar to open Leave Management.' },
      { label: '+ Apply Leave', desc: 'Click the "+ Apply Leave" button at the top-right.' },
      { label: 'Fill the form', desc: 'Choose the leave type, pick your start and end dates, and write a short reason.' },
      { label: 'Submit Request', desc: 'Click "Submit Request" — it goes to your manager for approval.' },
      { label: 'Track status', desc: 'Your request shows as Pending, then Approved or Rejected. You get a notification the moment it changes.' },
    ],
  },
  {
    title: 'Raise a support ticket',
    sub: 'Get help from HR for anything you\'re stuck on',
    color: 'linear-gradient(135deg,#2563eb,#0ea5e9)',
    icon: 'M3 18v-6a9 9 0 0 1 18 0v6 M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3z M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z',
    steps: [
      { label: 'Open Help Desk', desc: 'Click the headset icon in the top bar, or "Help Desk" in the sidebar.' },
      { label: 'Raise a ticket', desc: 'Click the "+ Raise a ticket" button.' },
      { label: 'Pick a category', desc: 'Choose what it\'s about — account access, payroll, leave, or other.' },
      { label: 'Describe it', desc: 'Add a clear subject and a few details so HR can help faster, then submit.' },
      { label: 'Get a reply', desc: 'When HR resolves it, you\'re notified and their response appears on your ticket.' },
    ],
  },
  {
    title: 'Change your password',
    sub: 'Update your own password anytime',
    color: 'linear-gradient(135deg,#be185d,#ec4899)',
    icon: 'M5 11h14a2 2 0 012 2v7a2 2 0 01-2 2H5a2 2 0 01-2-2v-7a2 2 0 012-2z M8 11V7a4 4 0 118 0v4',
    steps: [
      { label: 'Open My Profile', desc: 'Click "My Profile" in the sidebar.' },
      { label: 'Change Password', desc: 'In "Password & Security", click "Change Password".' },
      { label: 'Enter new password', desc: 'Type your new password and confirm it in the popup.' },
      { label: 'Update', desc: 'Click "Update Password" — it takes effect immediately.' },
      { label: 'Forgot it?', desc: 'On the sign-in screen use "Forgot Password?" to reset it with your email.' },
    ],
  },
  {
    title: 'View & download your payslip',
    sub: 'See your salary breakup and save a PDF',
    color: 'linear-gradient(135deg,#059669,#10b981)',
    icon: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8',
    steps: [
      { label: 'Open Payslips', desc: 'Click "Payslips" in the sidebar.' },
      { label: 'View payslip', desc: 'Click "View payslip" on the month you want.' },
      { label: 'Check the breakup', desc: 'Review your earnings, deductions and net take-home pay.' },
      { label: 'Download / Print', desc: 'Click "Download / Print PDF" to save or print a copy.' },
    ],
  },
  {
    title: 'Update your own details',
    sub: 'Keep your contact info current yourself',
    color: 'linear-gradient(135deg,#0891b2,#06b6d4)',
    icon: 'M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2 M12 11a4 4 0 100-8 4 4 0 000 8z M17 8l2 2 4-4',
    steps: [
      { label: 'Open My Profile', desc: 'Click "My Profile" in the sidebar.' },
      { label: 'Click Edit', desc: 'Hit "Edit" on "My Information".' },
      { label: 'Update fields', desc: 'Change your phone, date of birth, address or state.' },
      { label: 'Save changes', desc: 'Click "Save changes" — it updates instantly.' },
    ],
  },
  {
    title: 'Check the team leave calendar',
    sub: 'See who is off and plan around it',
    color: 'linear-gradient(135deg,#7c3aed,#a855f7)',
    icon: 'M19 4H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2zM16 2v4 M8 2v4 M3 10h18',
    steps: [
      { label: 'Open Leave Calendar', desc: 'Click "Leave Calendar" in the sidebar.' },
      { label: 'Pick a month', desc: 'Use Prev / Next (or "Today") to move between months.' },
      { label: 'Read the days', desc: 'Each day shows who is on leave and any holidays — hover a name for the leave type.' },
    ],
  },
  {
    title: 'Stay on top of notifications',
    sub: 'Never miss an approval or announcement',
    color: 'linear-gradient(135deg,#4f46e5,#6366f1)',
    icon: 'M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9 M13.73 21a2 2 0 01-3.46 0',
    steps: [
      { label: 'Watch the bell', desc: 'A red badge on the bell (top bar) means you have unread alerts — it flashes when a new one arrives.' },
      { label: 'Open it', desc: 'Click the bell to see your latest notifications.' },
      { label: 'Jump to it', desc: 'Click any notification to go straight to the related page.' },
    ],
  },
];

function Journey({ steps }) {
  const [h, setH] = useState(null);
  return (
    <>
      <div className="journey">
        {steps.map((s, i) => (
          <React.Fragment key={i}>
            <div
              className={`journey-step jt-${i % 5} ${h === i ? 'active' : ''}`}
              onMouseEnter={() => setH(i)} onMouseLeave={() => setH(null)}
              tabIndex={0} onFocus={() => setH(i)} onBlur={() => setH(null)}
            >
              {s.label}
            </div>
            {i < steps.length - 1 && <span className="journey-arrow" aria-hidden="true">→</span>}
          </React.Fragment>
        ))}
      </div>
      <div className="journey-desc">
        {h != null
          ? <p><b>{steps[h].label}</b> — {steps[h].desc}</p>
          : <p className="muted">Hover a step to see what to do</p>}
      </div>
    </>
  );
}

export default function Help() {
  const [active, setActive] = useState(null); // index of the guide being previewed
  const g = active != null ? GUIDES[active] : null;

  return (
    <>
      <div className="page-hero hero-help">
        <div>
          <h2>Website Help</h2>
          <p>Pick a topic to see a step-by-step guide. Hover any step in the preview to see exactly what to do.</p>
        </div>
      </div>

      <div className="help-tiles">
        {GUIDES.map((guide, i) => (
          <button className="help-tile" key={i} onClick={() => setActive(i)}>
            <div className="guide-ic" style={{ background: guide.color }}><Icon d={guide.icon} /></div>
            <div>
              <div className="help-tile-title">{guide.title}</div>
              <div className="help-tile-sub">{guide.sub}</div>
            </div>
            <span className="help-tile-arrow" aria-hidden="true">›</span>
          </button>
        ))}
      </div>

      {g && (
        <div className="modal-overlay" onClick={() => setActive(null)}>
          <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className="guide-ic" style={{ background: g.color }}><Icon d={g.icon} /></div>
                <div>
                  <h3 style={{ margin: 0 }}>{g.title}</h3>
                  <div style={{ fontSize: 12, color: 'var(--text-soft)' }}>{g.sub}</div>
                </div>
              </div>
              <span className="close-btn" onClick={() => setActive(null)}>×</span>
            </div>
            <div className="modal-body">
              <Journey steps={g.steps} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
