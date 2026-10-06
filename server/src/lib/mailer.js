import nodemailer from 'nodemailer';

// All credentials come from environment variables — nothing is hardcoded.
//   SMTP_HOST   e.g. smtp.gmail.com  (Google Workspace), smtp.zoho.in, smtp.office365.com …
//   SMTP_PORT   587 (STARTTLS) or 465 (implicit TLS)
//   SMTP_USER   the mailbox to authenticate as
//   SMTP_PASS   app password / mailbox password  (keep this secret; never commit it)
//   SMTP_FROM   optional "From" address (defaults to SMTP_USER)
//   SMTP_SECURE optional "true"/"false" (defaults to true when port is 465)
let cached = null;

export function mailConfigured() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function transport() {
  if (!mailConfigured()) return null;
  if (cached) return cached;
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465;
  cached = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,                      // TLS: true for 465, STARTTLS upgrade for 587
    requireTLS: !secure,         // force STARTTLS on 587 so credentials are never sent in the clear
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  return cached;
}

export function fromAddress() {
  return process.env.SMTP_FROM || process.env.SMTP_USER;
}

// Send one email. attachments: [{ filename, content: Buffer, contentType }]
export async function sendMail({ to, subject, text, html, attachments }) {
  const t = transport();
  if (!t) throw new Error('Email is not configured on the server (missing SMTP_* environment variables).');
  return t.sendMail({
    from: fromAddress(),
    to: Array.isArray(to) ? to.join(', ') : to,
    subject, text, html, attachments,
  });
}
