// api/pass.js
const { getSheetData, setCors, VISITORS_SHEET } = require('./_sheets');
const QRCode = require('qrcode');

const BASE_URL = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : (process.env.BASE_URL || 'http://localhost:3000');

module.exports = async (req, res) => {
  setCors(res);
  const visitorId = req.query.visitorId || req.url.split('/').pop().split('?')[0];

  try {
    const visitors = await getSheetData(VISITORS_SHEET);
    const visitor  = visitors.find(v => v.visitor_id === visitorId);

    if (!visitor) return res.status(404).send(errorPage('Pass Not Found', 'This pass link is invalid or expired.'));
    if (visitor.status !== 'APPROVED') return res.status(403).send(errorPage('Pass Not Active', `Visit status is <strong>${visitor.status}</strong>. Entry not permitted.`));

    // ─────────────────────────────────────────
    // QR now encodes a URL to staff.html?v=VISITOR_ID
    // When security scans this, browser opens staff portal
    // After logging in, auto-redirects to scan.html?v=VISITOR_ID for instant verification
    // ─────────────────────────────────────────
    const scanUrl  = `${BASE_URL}/staff.html?v=${visitorId}`;
    const qrImage  = await QRCode.toDataURL(scanUrl, {
      width: 280, margin: 2,
      color: { dark: '#1a1510', light: '#ffffff' },
    });

    const alreadyScanned = visitor.scan_status === 'SCANNED';
    const scanBadge = alreadyScanned
      ? `<div class="scan-badge scanned">✅ Already Scanned · ${new Date(visitor.scan_time).toLocaleString('en-IN')}</div>`
      : `<div class="scan-badge pending">⏳ Not Yet Scanned</div>`;

    const photoSection = visitor.photo_url
      ? `<div class="visitor-photo"><img src="${visitor.photo_url}" alt="Visitor Photo"></div>` : '';

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Entry Pass — ${visitor.visitor_name}</title>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=DM+Sans:wght@400;500;600&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    :root{--bg:#f7f4ef;--s:#fff;--b:#e4ddd4;--t:#1a1510;--tm:#6b6055;--td:#a89e93;--ac:#2c4a3e;--ok:#2c7a4b;--warn:#b8860b;}
    *{box-sizing:border-box;margin:0;padding:0;}
    body{min-height:100vh;background:var(--bg);display:flex;align-items:center;justify-content:center;font-family:'DM Sans',sans-serif;padding:20px;}
    body::before{content:'';position:fixed;inset:0;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)' opacity='0.025'/%3E%3C/svg%3E");opacity:.6;pointer-events:none;z-index:0;}
    .pass{position:relative;z-index:1;background:var(--s);border:1px solid var(--b);border-radius:24px;padding:30px;max-width:380px;width:100%;color:var(--t);box-shadow:0 8px 40px rgba(26,21,16,.12);}
    .pass::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,var(--ac),#c4622d,var(--ok));border-radius:24px 24px 0 0;}
    .pass-top{text-align:center;margin-bottom:20px;padding-bottom:16px;border-bottom:1px dashed var(--b);}
    .brand{font-family:'DM Mono',monospace;font-size:10px;letter-spacing:3px;color:var(--td);text-transform:uppercase;margin-bottom:8px;}
    .pass-title{font-family:'Playfair Display',serif;font-size:22px;font-weight:700;}
    .status-pill{display:inline-flex;align-items:center;gap:6px;margin-top:10px;background:rgba(44,122,75,.1);border:1px solid rgba(44,122,75,.25);color:var(--ok);padding:4px 14px;border-radius:20px;font-size:12px;font-weight:600;}
    .visitor-photo{text-align:center;margin:14px 0;}
    .visitor-photo img{width:72px;height:72px;border-radius:50%;object-fit:cover;border:2px solid var(--b);}
    .qr-wrap{background:var(--bg);border-radius:14px;padding:14px;margin:14px 0;text-align:center;border:1px solid var(--b);}
    .qr-wrap img{width:190px;height:190px;display:block;margin:0 auto;border-radius:4px;}
    .qr-note{font-family:'DM Mono',monospace;font-size:10px;color:var(--td);margin-top:8px;letter-spacing:1px;}
    .info{display:grid;gap:8px;margin:14px 0;}
    .row{display:flex;justify-content:space-between;align-items:baseline;gap:8px;}
    .lbl{font-size:11px;color:var(--td);text-transform:uppercase;letter-spacing:1px;font-family:'DM Mono',monospace;white-space:nowrap;}
    .val{font-size:13px;font-weight:600;color:var(--t);text-align:right;}
    .pass-id{font-family:'DM Mono',monospace;font-size:11px;color:var(--td);}
    .scan-badge{text-align:center;margin:10px 0;padding:8px 14px;border-radius:8px;font-size:12px;font-weight:600;}
    .scan-badge.scanned{background:rgba(44,122,75,.08);border:1px solid rgba(44,122,75,.2);color:var(--ok);}
    .scan-badge.pending{background:rgba(184,134,11,.07);border:1px solid rgba(184,134,11,.2);color:var(--warn);}
    .pass-footer{text-align:center;margin-top:14px;padding-top:12px;border-top:1px dashed var(--b);font-size:11px;color:var(--td);font-family:'DM Mono',monospace;}
  </style>
</head>
<body>
  <div class="pass">
    <div class="pass-top">
      <div class="brand">Company Visitor Pass</div>
      <div class="pass-title">🎟️ Entry Pass</div>
      <span class="status-pill"><span style="width:6px;height:6px;background:var(--ok);border-radius:50%;display:inline-block;"></span>APPROVED</span>
    </div>
    ${photoSection}
    ${scanBadge}
    <div class="qr-wrap">
      <img src="${qrImage}" alt="Entry QR Code">
      <div class="qr-note">SCAN AT SECURITY GATE</div>
    </div>
    <div class="info">
      <div class="row"><span class="lbl">Visitor</span><span class="val">${visitor.visitor_name}</span></div>
      <div class="row"><span class="lbl">Mobile</span><span class="val">${visitor.visitor_mobile}</span></div>
      <div class="row"><span class="lbl">Meeting</span><span class="val">${visitor.person_to_meet}</span></div>
      <div class="row"><span class="lbl">Purpose</span><span class="val">${visitor.purpose}</span></div>
      <div class="row"><span class="lbl">Date</span><span class="val">${visitor.visit_date}</span></div>
      <div class="row"><span class="lbl">Time</span><span class="val">${visitor.visit_time}</span></div>
      <div class="row"><span class="lbl">Pass ID</span><span class="val pass-id">${visitorId.slice(0,8).toUpperCase()}</span></div>
    </div>
    <div class="pass-footer">Valid for date of visit only · VisitorOS</div>
  </div>
</body>
</html>`);
  } catch (err) {
    console.error('[/pass]', err.message);
    res.status(500).send(errorPage('Error', err.message));
  }
};

function errorPage(title, msg) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${title}</title>
  <style>body{font-family:sans-serif;background:#f7f4ef;min-height:100vh;display:flex;align-items:center;justify-content:center}
  .b{background:#fff;border:1px solid #e4ddd4;border-radius:16px;padding:40px;text-align:center;max-width:380px}
  h1{color:#c0392b;margin-bottom:12px;font-size:20px}p{color:#6b6055;font-size:14px}</style>
  </head><body><div class="b"><h1>${title}</h1><p>${msg}</p><a href="/" style="color:#2c4a3e;margin-top:16px;display:block;font-size:13px">← Back</a></div></body></html>`;
}
