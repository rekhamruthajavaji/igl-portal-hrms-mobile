import React, { useEffect, useRef, useState } from 'react';
import api from '../api';

const fmt = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '';

// Clean up an uploaded signature image: make the paper/background transparent so only the
// ink shows (blending into the letter's white background) and crop to the signature.
function processSignatureImage(img) {
  // Scale very large photos down for performance.
  const maxW = 1200;
  const scale = img.naturalWidth > maxW ? maxW / img.naturalWidth : 1;
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);
  const image = ctx.getImageData(0, 0, w, h);
  const px = image.data;

  // Sample the four corners to learn the background colour + whether it's already transparent.
  const cornerIdx = [0, (w - 1) * 4, (h - 1) * w * 4, ((h - 1) * w + (w - 1)) * 4];
  let br = 0, bg = 0, bb = 0, ba = 0;
  cornerIdx.forEach(i => { br += px[i]; bg += px[i + 1]; bb += px[i + 2]; ba += px[i + 3]; });
  br /= 4; bg /= 4; bb /= 4; ba /= 4;

  // Only key out a solid background (skip if the image already has transparency).
  if (ba > 30) {
    const thresh = 70; // colour distance from the background that still counts as background
    for (let i = 0; i < px.length; i += 4) {
      const d = Math.hypot(px[i] - br, px[i + 1] - bg, px[i + 2] - bb);
      if (d < thresh) px[i + 3] = 0;                 // background → transparent
      else if (d < thresh + 40) px[i + 3] = Math.round(((d - thresh) / 40) * 255); // soft edge
    }
    ctx.putImageData(image, 0, 0);
  }

  // Crop to the signature's bounding box so it fills the space nicely.
  let minX = w, minY = h, maxX = 0, maxY = 0, found = false;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (px[(y * w + x) * 4 + 3] > 25) { found = true; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
    }
  }
  if (!found) return canvas.toDataURL('image/png');
  const pad = 6, cw = Math.min(w, maxX - minX + 1 + pad * 2), ch = Math.min(h, maxY - minY + 1 + pad * 2);
  const out = document.createElement('canvas');
  out.width = cw; out.height = ch;
  out.getContext('2d').drawImage(canvas, Math.max(0, minX - pad), Math.max(0, minY - pad), cw, ch, 0, 0, cw, ch);
  return out.toDataURL('image/png');
}

// Upload a signature image; the background is removed so only the signature shows.
function SignatureUpload({ onChange }) {
  const [preview, setPreview] = useState(null);
  const [err, setErr] = useState('');
  const inputRef = useRef(null);

  const handleFile = (file) => {
    setErr('');
    if (!file) return;
    if (!file.type.startsWith('image/')) { setErr('Please choose an image file (PNG or JPG).'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        try {
          const dataUrl = processSignatureImage(img);
          setPreview(dataUrl);
          onChange(dataUrl);
        } catch { setErr('Could not process that image. Please try another file.'); }
      };
      img.onerror = () => setErr('Could not read that image.');
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  };

  const clear = () => { setPreview(null); onChange(null); if (inputRef.current) inputRef.current.value = ''; };

  return (
    <div className="sign-upload">
      {!preview ? (
        <label className="sign-drop">
          <input ref={inputRef} type="file" accept="image/*" hidden onChange={(e) => handleFile(e.target.files[0])} />
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M17 8l-5-5-5 5" /><path d="M12 3v12" /></svg>
          <strong>Upload your signature</strong>
          <span>PNG or JPG. The background is removed automatically so only your signature appears on the letter.</span>
        </label>
      ) : (
        <div className="sign-uploaded">
          <div className="sign-uploaded-frame"><img src={preview} alt="Your signature" /></div>
          <button type="button" className="btn btn-sm btn-secondary" onClick={clear}>Change signature</button>
        </div>
      )}
      {err && <div className="sign-note">{err}</div>}
    </div>
  );
}

function LetterView({ data }) {
  const c = data.company;
  return (
    <div className="letter-sheet">
      <div className="letter-head">
        <img src="/logo.png" alt="iGenie Labs" className="letter-logo" />
        <div>
          <h3>{c.name}</h3>
          <p>{c.address}</p>
        </div>
      </div>
      <hr />
      <p className="lt">Date: {data.date}</p>
      <p className="lt">To<br /><strong>{data.salut}</strong><br />{data.designation}</p>
      <p className="lt"><strong>Subject: Confirmation of Employment upon Completion of Probation</strong></p>
      <p className="lt">Dear {data.salut},</p>
      <p className="lt">We are pleased to inform you that you have successfully completed your probationary period of six (6) months, effective from {data.dojStr} to {data.probationEndStr}.</p>
      <p className="lt">Based on your performance and conduct during the probationary period, the management is pleased to confirm your employment as {data.designation} with {c.name}, with effect from {data.confirmEffectiveStr}.</p>
      <p className="lt">All other terms and conditions of your Employment Agreement dated {data.dojStr} shall continue to remain unchanged and in full force.</p>
      <p className="lt">We appreciate your contribution to the organization and look forward to your continued commitment and association with us.</p>
      <p className="lt">We wish you continued success with {c.name}.</p>
      <p className="lt" style={{ marginTop: 18, marginBottom: 2 }}>For {c.name}</p>
      <img src="/signature.png" alt="Authorized signatory" className="letter-sign" />
      <p className="lt"><strong>Authorized Signatory</strong><br />Name: {data.signatory.name}<br />Designation: {data.signatory.title}</p>
    </div>
  );
}

export default function ProbationLetter() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(null);   // letter data being viewed/signed
  const [sig, setSig] = useState(null);
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const load = () => api.get('/probation-letters/mine').then(r => setRows(r.data)).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const open = async (row) => {
    setSig(null); setAgree(false); setMsg('');
    const { data } = await api.get(`/probation-letters/${row.id}/data`);
    setActive(data);
  };

  const sign = async () => {
    if (!sig || !agree) return;
    setBusy(true); setMsg('');
    try {
      await api.post(`/probation-letters/${active.id}/sign`, { signature: sig });
      setMsg('Thank you — your confirmation letter has been signed.');
      setActive(null);
      load();
    } catch (e) {
      setMsg(e.response?.data?.error || 'Could not sign the letter. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const download = async (row) => {
    const r = await api.get(`/probation-letters/${row.id}/pdf`, { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' }));
    const a = document.createElement('a');
    a.href = url; a.download = `Probation-Confirmation-Letter.pdf`;
    document.body.appendChild(a); a.click(); a.remove();
    window.URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="page-hero hero-payslips">
        <div>
          <h2>Confirmation Letter</h2>
          <p>Review your probation confirmation letter and sign it digitally.</p>
        </div>
      </div>

      {msg && <div className="success-msg">{msg}</div>}

      {loading ? <div className="loader" /> : (
        <div className="card">
          {rows.length === 0 && <div className="empty">You don't have a probation confirmation letter yet.</div>}
          {rows.map(r => (
            <div key={r.id} className="letter-row">
              <div>
                <strong>Probation Confirmation Letter</strong>
                <div className="letter-sub">
                  Sent {fmt(r.sent_at)}
                  {r.status === 'signed'
                    ? <span className="badge badge-success" style={{ marginLeft: 8 }}>Signed on {fmt(r.signed_at)}</span>
                    : <span className="badge badge-warning" style={{ marginLeft: 8 }}>Awaiting your signature</span>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {r.status === 'signed' ? (
                  <>
                    <button className="btn btn-sm btn-secondary" onClick={() => open(r)}>View</button>
                    <button className="btn btn-sm btn-primary" onClick={() => download(r)}>Download PDF</button>
                  </>
                ) : (
                  <button className="btn btn-sm btn-primary" onClick={() => open(r)}>Review &amp; Sign</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {active && (
        <div className="modal-overlay" onClick={() => !busy && setActive(null)}>
          <div className="payslip-modal" onClick={(e) => e.stopPropagation()}>
            <div className="payslip-bar">
              <h3>Probation Confirmation Letter</h3>
              <div className="actions">
                <button className="btn btn-sm btn-secondary" onClick={() => setActive(null)} disabled={busy}>Close</button>
              </div>
            </div>

            <div style={{ padding: 20 }}>
              <LetterView data={active} />

              {active.status === 'signed' ? (
                <div className="sign-block">
                  <h4>Acknowledgement</h4>
                  <p className="sign-ack">
                    I, <strong>{active.fullName}</strong>, acknowledge receipt of this letter and confirm my acceptance of the
                    confirmation of my employment.
                  </p>
                  <div className="ack-sign-box">
                    {active.signature && <img src={active.signature} alt="Your signature" className="ack-sign-img" />}
                    <div className="ack-sign-rule" />
                    <div className="ack-sign-foot">
                      <span>Signature: Digitally signed by {active.fullName}</span>
                      <span>Date: {fmt(active.signedAt)}</span>
                    </div>
                  </div>
                  <div className="sign-done">✓ You signed this letter on {fmt(active.signedAt)}.</div>
                </div>
              ) : (
                <div className="sign-block">
                  <h4>Acknowledgement &amp; Digital Signature</h4>
                  <p className="sign-ack">
                    I, <strong>{active.fullName}</strong>, acknowledge receipt of this letter and confirm my acceptance of the
                    confirmation of my employment.
                  </p>
                  <SignatureUpload onChange={setSig} />
                  <label className="sign-agree">
                    <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
                    I agree that this uploaded signature is legally equivalent to my handwritten signature.
                  </label>
                  <button className="btn btn-primary" disabled={!sig || !agree || busy} onClick={sign}>
                    {busy ? 'Signing…' : 'Sign & Submit'}
                  </button>
                  {(!sig || !agree) && <div className="sign-note">Upload your signature and tick the box to enable signing.</div>}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
