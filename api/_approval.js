// api/_approval.js — Shared approve/reject logic
const { getSheetData, updateRowByColumn, VISITORS_SHEET } = require('./_sheets');
const { sendPassToVisitor, sendRejectionNotice } = require('./_whatsapp');
const QRCode = require('qrcode');

const BASE_URL = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : (process.env.BASE_URL || 'http://localhost:3000');

function htmlPage(title, body, color = '#7c6af0') {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title}</title>
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{min-height:100vh;background:#080810;display:flex;align-items:center;justify-content:center;font-family:'Space Grotesk',sans-serif;padding:20px}
    .card{background:#0f0f1a;border:1px solid #1e1e2e;border-radius:20px;padding:48px 36px;text-align:center;max-width:420px;width:100%}
    .icon{font-size:52px;margin-bottom:20px}
    h1{font-size:26px;font-weight:700;color:${color};margin-bottom:12px}
    p{color:#9ca3af;line-height:1.7;font-size:15px}
    a{display:inline-block;margin-top:24px;color:#7c6af0;text-decoration:none;font-size:14px}
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${body.icon}</div>
    <h1>${title}</h1>
    <p>${body.text}</p>
    <a href="/">← Back to Registration</a>
  </div>
</body>
</html>`;
}

async function handleApproval(visitorId, res) {
  try {
    const visitors = await getSheetData(VISITORS_SHEET);
    const visitor = visitors.find(v => v.visitor_id === visitorId);

    if (!visitor) {
      const html = htmlPage('Not Found', { icon: '❓', text: 'Visitor record not found.' }, '#f05a5a');
      return res ? res.status(404).send(html) : null;
    }
    if (visitor.status !== 'PENDING') {
      const html = htmlPage('Already Processed', { icon: 'ℹ️', text: `This visitor was already <strong>${visitor.status}</strong>.` }, '#9ca3af');
      return res ? res.status(200).send(html) : null;
    }

    const passLink = `${BASE_URL}/pass/${visitorId}`;
    const qrData   = JSON.stringify({ visitor_id: visitorId, type: 'ENTRY_PASS', v: 1 });
    const approvalTime = new Date().toISOString();

    await updateRowByColumn(VISITORS_SHEET, 'visitor_id', visitorId, {
      status: 'APPROVED',
      approval_time: approvalTime,
      pass_link: passLink,
      qr_data: qrData,
    });

    // Send pass to visitor (non-blocking)
    sendPassToVisitor(visitor.visitor_mobile, visitor, passLink).catch(e => {
      console.error('[WA] pass send failed:', e.message);
    });

    const html = htmlPage('Visitor Approved', {
      icon: '✅',
      text: `<strong>${visitor.visitor_name}</strong> has been approved.<br>Pass link sent to ${visitor.visitor_mobile}.`,
    }, '#5af07c');
    return res ? res.status(200).send(html) : null;

  } catch (err) {
    console.error('[handleApproval]', err.message);
    const html = htmlPage('Error', { icon: '⚠️', text: err.message }, '#f05a5a');
    return res ? res.status(500).send(html) : null;
  }
}

async function handleRejection(visitorId, res) {
  try {
    const visitors = await getSheetData(VISITORS_SHEET);
    const visitor = visitors.find(v => v.visitor_id === visitorId);

    if (!visitor) {
      const html = htmlPage('Not Found', { icon: '❓', text: 'Visitor record not found.' }, '#f05a5a');
      return res ? res.status(404).send(html) : null;
    }
    if (visitor.status !== 'PENDING') {
      const html = htmlPage('Already Processed', { icon: 'ℹ️', text: `This visitor was already <strong>${visitor.status}</strong>.` }, '#9ca3af');
      return res ? res.status(200).send(html) : null;
    }

    await updateRowByColumn(VISITORS_SHEET, 'visitor_id', visitorId, {
      status: 'REJECTED',
      approval_time: new Date().toISOString(),
    });

    sendRejectionNotice(visitor.visitor_mobile, visitor.visitor_name).catch(e => {
      console.error('[WA] rejection notice failed:', e.message);
    });

    const html = htmlPage('Visitor Rejected', {
      icon: '❌',
      text: `<strong>${visitor.visitor_name}</strong> has been rejected and notified.`,
    }, '#f05a5a');
    return res ? res.status(200).send(html) : null;

  } catch (err) {
    console.error('[handleRejection]', err.message);
    const html = htmlPage('Error', { icon: '⚠️', text: err.message }, '#f05a5a');
    return res ? res.status(500).send(html) : null;
  }
}

module.exports = { handleApproval, handleRejection };
