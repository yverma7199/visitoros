// api/pass.js
const { getSheetData, setCors, VISITORS_SHEET } = require('./_sheets');
const QRCode = require('qrcode');

module.exports = async (req, res) => {
  setCors(res);
  const visitorId = req.query.visitorId || req.url.split('/').pop();

  try {
    const visitors = await getSheetData(VISITORS_SHEET);
    const visitor  = visitors.find(v => v.visitor_id === visitorId);

    if (!visitor) {
      return res.status(404).send(errorPage('Pass Not Found', 'This pass link is invalid or expired.'));
    }
    if (visitor.status !== 'APPROVED') {
      return res.status(403).send(errorPage('Pass Not Active', `Visit status is <strong>${visitor.status}</strong>. Entry not permitted.`));
    }

    const qrData  = visitor.qr_data || JSON.stringify({ visitor_id: visitorId, type: 'ENTRY_PASS', v: 1 });
    const qrImage = await QRCode.toDataURL(qrData, {
      width: 280,
      margin: 2,
      color: { dark: '#080810', light: '#ffffff' },
    });

    const alreadyScanned = visitor.scan_status === 'SCANNED';
    const scanBadge = alreadyScanned
      ? `<div class="scan-badge scanned">✅ Already Scanned · ${new Date(visitor.scan_time).toLocaleString('en-IN')}</div>`
      : `<div class="scan-badge pending">⏳ Not Yet Scanned</div>`;

    const photoSection = visitor.photo_url
      ? `<div class="visitor-photo"><img src="${visitor.photo_url}" alt="Visitor Photo"></div>`
      : '';

    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Entry Pass — ${visitor.visitor_name}</title>
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700&family=Syne+Mono&display=swap" rel="stylesheet">
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{min-height:100vh;background:#080810;display:flex;align-items:center;justify-content:center;font-family:'Space Grotesk',sans-serif;padding:20px}
    .pass{background:#0f0f1a;border:1px solid #1e1e2e;border-radius:24px;padding:32px;max-width:400px;width:100%;color:#e2e2f0;position:relative;overflow:hidden}
    .pass::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#7c6af0,#f0a05a,#5af07c)}
    .pass-top{text-align:center;margin-bottom:20px;padding-bottom:16px;border-bottom:1px dashed #1e1e2e}
    .brand{font-family:'Syne Mono',monospace;font-size:10px;letter-spacing:3px;color:#3d3d55;text-transform:uppercase;margin-bottom:8px}
    .pass-title{font-size:20px;font-weight:700;letter-spacing:-0.5px}
    .status-pill{display:inline-flex;align-items:center;gap:6px;margin-top:10px;background:rgba(90,240,124,0.12);border:1px solid rgba(90,240,124,0.25);color:#5af07c;padding:4px 14px;border-radius:20px;font-size:12px;font-weight:600}
    .visitor-photo{text-align:center;margin:16px 0}
    .visitor-photo img{width:80px;height:80px;border-radius:50%;object-fit:cover;border:2px solid #1e1e2e}
    .qr-wrap{background:#fff;border-radius:16px;padding:16px;margin:16px 0;text-align:center}
    .qr-wrap img{width:200px;height:200px;display:block;margin:0 auto}
    .qr-note{font-family:'Syne Mono',monospace;font-size:10px;color:#6b6b8a;margin-top:8px;text-align:center;letter-spacing:1px}
    .info{display:grid;gap:10px;margin:16px 0}
    .row{display:flex;justify-content:space-between;align-items:baseline;gap:8px}
    .lbl{font-size:11px;color:#3d3d55;text-transform:uppercase;letter-spacing:1px;font-family:'Syne Mono',monospace;white-space:nowrap}
    .val{font-size:14px;font-weight:600;color:#c8c8e0;text-align:right}
    .pass-id{font-family:'Syne Mono',monospace;font-size:11px;color:#5a5a7a}
    .scan-badge{text-align:center;margin:12px 0;padding:8px 16px;border-radius:8px;font-size:12px;font-weight:600}
    .scan-badge.scanned{background:rgba(90,240,124,0.08);border:1px solid rgba(90,240,124,0.2);color:#5af07c}
    .scan-badge.pending{background:rgba(240,224,90,0.08);border:1px solid rgba(240,224,90,0.2);color:#f0e05a}
    .pass-footer{text-align:center;margin-top:16px;padding-top:14px;border-top:1px dashed #1e1e2e;font-size:11px;color:#3d3d55;font-family:'Syne Mono',monospace}
  </style>
</head>
<body>
  <div class="pass">
    <div class="pass-top">
      <div class="brand">Company Visitor Pass</div>
      <div class="pass-title">🎟️ Entry Pass</div>
      <span class="status-pill"><span style="width:6px;height:6px;background:#5af07c;border-radius:50%;display:inline-block;"></span>APPROVED</span>
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
  <style>body{font-family:sans-serif;background:#080810;color:#e2e2f0;min-height:100vh;display:flex;align-items:center;justify-content:center}
  .b{background:#0f0f1a;border:1px solid #1e1e2e;border-radius:16px;padding:40px;text-align:center;max-width:380px}
  h1{color:#f05a5a;margin-bottom:12px}p{color:#9ca3af}</style>
  </head><body><div class="b"><h1>${title}</h1><p>${msg}</p><a href="/" style="color:#7c6af0;margin-top:16px;display:block">← Back</a></div></body></html>`;
}
