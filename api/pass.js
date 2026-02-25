// api/pass.js — Entry pass page with PDF download
const { getSheetData, setCors, VISITORS_SHEET } = require('./_sheets');
const QRCode = require('qrcode');

function getBaseUrl() {
  if (process.env.BASE_URL && !process.env.BASE_URL.includes('localhost')) return process.env.BASE_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return 'https://visitoros.vercel.app';
}

module.exports = async (req, res) => {
  setCors(res);
  const visitorId = req.query.visitorId || req.url.split('/').pop().split('?')[0];
  const autoPdf   = req.query.pdf === '1';

  try {
    const visitors = await getSheetData(VISITORS_SHEET);
    const visitor  = visitors.find(v => v.visitor_id === visitorId);

    if (!visitor) return res.status(404).send(errorPage('Pass Not Found', 'This pass link is invalid or expired.'));
    if (visitor.status !== 'APPROVED') return res.status(403).send(errorPage('Pass Not Active', `Visit status is <strong>${visitor.status}</strong>. Entry not permitted.`));

    const BASE    = getBaseUrl();
    const scanUrl = `${BASE}/staff.html?v=${visitorId}`;
    const qrData  = await QRCode.toDataURL(scanUrl, {
      width: 300, margin: 2,
      color: { dark: '#1a1510', light: '#ffffff' },
    });

    const passId  = visitorId.slice(0, 8).toUpperCase();
    const scanned = visitor.scan_status === 'SCANNED';
    const photo   = visitor.photo_url
      ? `<img class="photo" src="${visitor.photo_url}" alt="">`
      : `<div class="photo no-photo">👤</div>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Entry Pass — ${visitor.visitor_name}</title>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=DM+Sans:wght@400;500;600&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
:root{--bg:#f7f4ef;--s:#fff;--b:#e4ddd4;--t:#1a1510;--tm:#6b6055;--td:#a89e93;--ac:#2c4a3e;--ok:#2c7a4b;--warn:#b8860b;}
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:'DM Sans',sans-serif;background:var(--bg);color:var(--t);min-height:100vh;padding:20px;display:flex;flex-direction:column;align-items:center;gap:14px;}

/* Download bar — screen only */
.dl-bar{width:100%;max-width:460px;display:flex;align-items:center;justify-content:space-between;}
.dl-hint{font-size:12px;color:var(--td);font-family:'DM Mono',monospace;}
.dl-btn{display:flex;align-items:center;gap:7px;padding:9px 20px;border-radius:8px;border:none;background:var(--ac);color:#fff;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:600;cursor:pointer;text-decoration:none;transition:background .15s;}
.dl-btn:hover{background:#1e3329;}
.dl-btn svg{width:15px;height:15px;flex-shrink:0;}

/* Pass card */
.pass{background:var(--s);border:1px solid var(--b);border-radius:20px;padding:28px 24px;max-width:460px;width:100%;box-shadow:0 8px 40px rgba(26,21,16,.12);position:relative;}
.pass::before{content:'';position:absolute;top:0;left:0;right:0;height:4px;background:linear-gradient(90deg,var(--ac),#c4622d,var(--ok));border-radius:20px 20px 0 0;}

/* Header */
.ph{text-align:center;padding-bottom:18px;border-bottom:1px dashed var(--b);margin-bottom:18px;}
.pb{font-family:'DM Mono',monospace;font-size:10px;letter-spacing:3px;color:var(--td);text-transform:uppercase;margin-bottom:5px;}
.pt{font-family:'Playfair Display',serif;font-size:22px;font-weight:700;}
.pill{display:inline-flex;align-items:center;gap:5px;margin-top:8px;background:rgba(44,122,75,.1);border:1px solid rgba(44,122,75,.25);color:var(--ok);padding:3px 12px;border-radius:20px;font-size:12px;font-weight:600;}
.dot{width:6px;height:6px;background:var(--ok);border-radius:50%;}

/* Visual row */
.vis{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-bottom:16px;}
.photo{width:76px;height:76px;border-radius:50%;object-fit:cover;border:2px solid var(--b);flex-shrink:0;}
.no-photo{width:76px;height:76px;border-radius:50%;background:var(--bg);border:2px solid var(--b);display:flex;align-items:center;justify-content:center;font-size:28px;flex-shrink:0;}
.qr-wrap{flex:1;text-align:center;}
.qr-wrap img{width:140px;height:140px;display:block;margin:0 auto;border-radius:6px;}
.qr-lbl{font-family:'DM Mono',monospace;font-size:9px;color:var(--td);letter-spacing:1.5px;text-transform:uppercase;margin-top:5px;}

/* Scan badge */
.scan{text-align:center;padding:6px 12px;border-radius:7px;font-size:12px;font-weight:600;margin-bottom:14px;}
.scan.ok{background:rgba(44,122,75,.08);border:1px solid rgba(44,122,75,.2);color:var(--ok);}
.scan.pending{background:rgba(184,134,11,.07);border:1px solid rgba(184,134,11,.2);color:var(--warn);}

/* Info table */
.info{border:1px solid var(--b);border-radius:10px;overflow:hidden;margin-bottom:14px;}
.ir{display:flex;justify-content:space-between;align-items:center;padding:8px 13px;border-bottom:1px solid #f5f0eb;}
.ir:last-child{border-bottom:none;}
.ir:nth-child(even){background:var(--bg);}
.il{font-size:11px;color:var(--td);font-family:'DM Mono',monospace;text-transform:uppercase;letter-spacing:1px;}
.iv{font-size:13px;font-weight:600;text-align:right;}

/* Footer */
.pf{text-align:center;padding-top:12px;border-top:1px dashed var(--b);font-size:10px;color:var(--td);font-family:'DM Mono',monospace;letter-spacing:1px;}

/* Print / PDF */
@media print{
  @page{margin:12mm;size:A4;}
  body{background:#fff;padding:0;display:block;}
  .dl-bar{display:none!important;}
  .pass{box-shadow:none;border:1px solid #ccc;border-radius:0;max-width:100%;page-break-inside:avoid;}
  .pass::before,.pill,.scan,.ir:nth-child(even){-webkit-print-color-adjust:exact;print-color-adjust:exact;}
}
</style>
</head>
<body>

<div class="dl-bar">
  <span class="dl-hint">Pass ID: ${passId}</span>
  <button class="dl-btn" onclick="savePDF()">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
    Download PDF
  </button>
</div>

<div class="pass">
  <div class="ph">
    <div class="pb">Company Visitor Pass</div>
    <div class="pt">🎟️ Entry Pass</div>
    <span class="pill"><span class="dot"></span>APPROVED</span>
  </div>

  <div class="vis">
    ${photo}
    <div class="qr-wrap">
      <img src="${qrData}" alt="QR Code">
      <div class="qr-lbl">Scan at security gate</div>
    </div>
  </div>

  <div class="scan ${scanned ? 'ok' : 'pending'}">
    ${scanned
      ? `✅ Already Entered · ${new Date(visitor.scan_time).toLocaleString('en-IN',{dateStyle:'short',timeStyle:'short'})}`
      : '⏳ Not Yet Scanned'}
  </div>

  <div class="info">
    <div class="ir"><span class="il">Visitor</span><span class="iv">${visitor.visitor_name}</span></div>
    <div class="ir"><span class="il">Mobile</span><span class="iv">${visitor.visitor_mobile}</span></div>
    <div class="ir"><span class="il">Meeting</span><span class="iv">${visitor.person_to_meet}</span></div>
    <div class="ir"><span class="il">Purpose</span><span class="iv">${visitor.purpose}</span></div>
    <div class="ir"><span class="il">Date</span><span class="iv">${visitor.visit_date}</span></div>
    <div class="ir"><span class="il">Time</span><span class="iv">${visitor.visit_time}</span></div>
    <div class="ir"><span class="il">Pass ID</span><span class="iv" style="font-family:'DM Mono',monospace;font-size:11px;color:var(--td)">${passId}</span></div>
  </div>

  <div class="pf">Valid for date of visit only &nbsp;·&nbsp; VisitorOS</div>
</div>

<script>
function savePDF(){
  var orig = document.title;
  document.title = 'EntryPass-${visitor.visitor_name.replace(/\s+/g,'-')}-${passId}';
  window.print();
  document.title = orig;
}
${autoPdf ? 'window.addEventListener("load",function(){setTimeout(savePDF,900);});' : ''}
</script>
</body>
</html>`);

  } catch(err) {
    console.error('[/pass]', err.message);
    return res.status(500).send(errorPage('Error', err.message));
  }
};

function errorPage(t, m) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${t}</title>
  <style>body{font-family:sans-serif;background:#f7f4ef;min-height:100vh;display:flex;align-items:center;justify-content:center}
  .b{background:#fff;border:1px solid #e4ddd4;border-radius:16px;padding:40px;text-align:center;max-width:380px}
  h1{color:#c0392b;margin-bottom:12px}p{color:#6b6055;font-size:14px}</style>
  </head><body><div class="b"><h1>${t}</h1><p>${m}</p><a href="/" style="color:#2c4a3e;margin-top:16px;display:block;font-size:13px">← Back</a></div></body></html>`;
}
