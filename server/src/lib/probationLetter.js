import PDFDocument from 'pdfkit';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ASSET = (f) => path.join(__dirname, '..', 'assets', 'fonts', f);
const LOGO_PATH = path.join(__dirname, '..', '..', '..', 'client', 'public', 'logo.png');
const SIGN_PATH = path.join(__dirname, '..', 'assets', 'signature.png'); // authorized signatory's signature
const FONT_REG = ASSET('Hind-Regular.ttf');
const FONT_SEMI = ASSET('Hind-SemiBold.ttf');
const FONT_BOLD = ASSET('Hind-Bold.ttf');

export const COMPANY = 'IGENIE LABS PRIVATE LIMITED';
export const ADDRESS = 'D.No. 15/369-B, First Floor, Jogappagari Veedhi, Madanapalle, Andhra Pradesh 517325, India';
export const SIGNATORY = { name: 'Praneel Peruru', title: 'Director - India Operations' };

const pad = (n) => String(n).padStart(2, '0');
const fmt = (d) => { const x = new Date(d); return `${pad(x.getDate())}/${pad(x.getMonth() + 1)}/${x.getFullYear()}`; };
const addMonths = (d, m) => { const x = new Date(d); x.setMonth(x.getMonth() + m); return x; };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

// Derive every personalised field from the employee record so the letter differs per person.
export function probationLetterData(emp) {
  const doj = new Date(emp.joining_date);
  const confirmEffective = addMonths(doj, 6);          // e.g. joining 01/01 -> 01/07
  const probationEnd = addDays(confirmEffective, -1);  // the day before -> 30/06
  const g = String(emp.gender || '').trim().toLowerCase();
  const honorific = g.startsWith('f') ? 'Ms.' : (g.startsWith('m') ? 'Mr.' : ''); // omit if unknown, never guess
  const fullName = `${emp.first_name || ''} ${emp.last_name || ''}`.trim();
  const salut = honorific ? `${honorific} ${fullName}` : fullName;
  return {
    date: fmt(new Date()),
    fullName, salut,
    designation: emp.designation || 'Employee',
    dojStr: fmt(doj),
    probationEndStr: fmt(probationEnd),
    confirmEffectiveStr: fmt(confirmEffective),
  };
}

// Convert a PNG/JPEG data URL (from the browser signature pad) into a Buffer for pdfkit.
function dataUrlToBuffer(dataUrl) {
  const m = /^data:image\/\w+;base64,(.+)$/.exec(dataUrl || '');
  return m ? Buffer.from(m[1], 'base64') : null;
}

// Build the confirmation-letter PDF document for one employee (not yet piped/ended).
// Callers pipe it to a file (to store) or straight to an HTTP response (to download).
// opts.signature (PNG data URL) + opts.signedDate fill in the employee's acknowledgement signature.
export function createProbationLetterDoc(emp, opts = {}) {
      const L = probationLetterData(emp);
      const doc = new PDFDocument({ size: 'A4', margin: 56 });

      let FB = 'Helvetica', FSB = 'Helvetica-Bold', FBB = 'Helvetica-Bold';
      if (fs.existsSync(FONT_REG)) { doc.registerFont('R', FONT_REG); FB = 'R'; }
      if (fs.existsSync(FONT_SEMI)) { doc.registerFont('SB', FONT_SEMI); FSB = 'SB'; } else FSB = FB;
      if (fs.existsSync(FONT_BOLD)) { doc.registerFont('B', FONT_BOLD); FBB = 'B'; }

      const ink = '#1f2430', body = '#33384a', mute = '#6b7180', line = '#e4e7ee';
      const left = 56, right = 539, W = right - left;

      // Letterhead
      try { if (fs.existsSync(LOGO_PATH)) doc.image(LOGO_PATH, left, 48, { height: 38 }); } catch { /* no logo */ }
      doc.fillColor(ink).font(FBB).fontSize(15).text(COMPANY, left + 84, 52, { width: W - 84 });
      doc.fillColor(mute).font(FB).fontSize(8.5).text(ADDRESS, left + 84, 72, { width: W - 84 });
      doc.moveTo(left, 102).lineTo(right, 102).strokeColor(line).lineWidth(1).stroke();

      const S = 10; // body font size — tuned so the whole letter fits comfortably on one A4 page
      let y = 118;
      const para = (text, opts = {}) => {
        doc.font(opts.font || FB).fontSize(opts.size || S).fillColor(opts.color || body)
          .text(text, left, y, { width: W, align: opts.align || 'left', lineGap: 2 });
        y = doc.y + (opts.gap ?? 8);
      };

      para(`Date: ${L.date}`, { gap: 12 });

      // Recipient
      doc.font(FB).fontSize(S).fillColor(body).text('To', left, y); y = doc.y + 1;
      doc.font(FSB).fontSize(S).fillColor(ink).text(L.salut, left, y); y = doc.y;
      doc.font(FB).fontSize(S).fillColor(body).text(L.designation, left, y); y = doc.y + 12;

      doc.font(FSB).fontSize(S).fillColor(ink)
        .text('Subject: Confirmation of Employment upon Completion of Probation', left, y, { width: W }); y = doc.y + 12;

      para(`Dear ${L.salut},`);
      para(`We are pleased to inform you that you have successfully completed your probationary period of six (6) months, effective from ${L.dojStr} to ${L.probationEndStr}.`);
      para(`Based on your performance and conduct during the probationary period, the management is pleased to confirm your employment as ${L.designation} with ${COMPANY}, with effect from ${L.confirmEffectiveStr}.`);
      para(`All other terms and conditions of your Employment Agreement dated ${L.dojStr} shall continue to remain unchanged and in full force.`);
      para(`We appreciate your contribution to the organization and look forward to your continued commitment and association with us.`);
      para(`We wish you continued success with ${COMPANY}.`, { gap: 16 });

      // Signatory — the handwritten signature sits between "For <company>" and "Authorized Signatory".
      doc.font(FB).fontSize(S).fillColor(body).text(`For ${COMPANY}`, left, y); y = doc.y + 4;
      try {
        if (fs.existsSync(SIGN_PATH)) { doc.image(SIGN_PATH, left, y, { width: 135 }); y += 30; }
        else { y += 26; }
      } catch { y += 26; }
      doc.font(FSB).fontSize(S).fillColor(ink).text('Authorized Signatory', left, y); y = doc.y + 1;
      doc.font(FB).fontSize(S).fillColor(body).text(`Name: ${SIGNATORY.name}`, left, y); y = doc.y;
      doc.text(`Designation: ${SIGNATORY.title}`, left, y); y = doc.y + 18;

      // Acknowledgement
      doc.moveTo(left, y).lineTo(right, y).strokeColor(line).stroke(); y += 14;
      doc.font(FSB).fontSize(S).fillColor(ink).text('Acknowledgement', left, y); y = doc.y + 6;
      doc.font(FB).fontSize(S).fillColor(body).text(
        `I, ${L.fullName}, acknowledge receipt of this letter and confirm my acceptance of the confirmation of my employment.`,
        left, y, { width: W, lineGap: 2 }); y = doc.y + 18;

      const sigBuf = dataUrlToBuffer(opts.signature);
      if (sigBuf) {
        // Signed: employee signature sits directly above the signature line, left-aligned,
        // mirroring the authorized-signatory block above.
        try { doc.image(sigBuf, left, y, { fit: [170, 42] }); } catch { /* bad image */ }
        const lineY = y + 46;
        doc.moveTo(left, lineY).lineTo(left + 240, lineY).lineWidth(1).strokeColor('#c7ccd8').stroke();
        const labelY = lineY + 5;
        doc.font(FB).fontSize(S).fillColor(body).text('Signature:', left, labelY);
        doc.text(`Date: ${opts.signedDate || L.date}`, left + 300, labelY);
        doc.font(FSB).fontSize(8.5).fillColor(mute).text(`Digitally signed by ${L.fullName}`, left, labelY + 15);
      } else {
        doc.text('Signature: ____________________', left, y + 6);
        doc.text('Date: ____________________', left + 280, y + 6);
      }

      return doc;
}

// Render the letter to a PDF file on disk. Resolves when written.
export function generateProbationLetter(emp, outPath, opts = {}) {
  return new Promise((resolve, reject) => {
    try {
      const doc = createProbationLetterDoc(emp, opts);
      const stream = fs.createWriteStream(outPath);
      doc.pipe(stream);
      doc.end();
      stream.on('finish', () => resolve(outPath));
      stream.on('error', reject);
    } catch (e) { reject(e); }
  });
}

// Render the letter to an in-memory Buffer (used as an email attachment).
export function probationLetterToBuffer(emp, opts = {}) {
  return new Promise((resolve, reject) => {
    try {
      const doc = createProbationLetterDoc(emp, opts);
      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      doc.end();
    } catch (e) { reject(e); }
  });
}

// Filename used for both the stored document and the direct download.
export function probationLetterFileName(emp) {
  const name = `${emp.first_name || ''}_${emp.last_name || ''}`.trim().replace(/[^a-zA-Z0-9._-]+/g, '_');
  return `Probation-Confirmation-Letter-${name || emp.employee_code}.pdf`;
}
