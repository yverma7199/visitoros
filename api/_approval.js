// api/_approval.js — Shared approve/reject logic
const { getSheetData, updateRowByColumn, VISITORS_SHEET } = require('./_sheets');
const { sendPassToVisitor, sendRejectionNotice } = require('./_whatsapp');

// ─────────────────────────────────────────
// FIX: BASE_URL must be production URL, not localhost
// VERCEL_URL is automatically set by Vercel on every deployment
// Always prefer it over hardcoded BASE_URL env var
// ─────────────────────────────────────────
function getBaseUrl() {
  // Always use BASE_URL env var (set to https://visitoros.vercel.app in Vercel)
  // NEVER use VERCEL_URL — that is the preview deployment URL, not production
  if (process.env.BASE_URL && !process.env.BASE_URL.includes('localhost')) {
    return process.env.BASE_URL;
  }
  return 'https://visitoros.vercel.app';
}

function htmlPage(title, body, color = '#2c4a3e') {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title}</title>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=DM+Sans:wght@400;500;600&family=DM+Mono:wght@400&display=swap" rel="stylesheet">
  <style>
    :root{--ac:${color};}
    *{box-sizing:border-box;margin:0;padding:0;}
    body{min-height:100vh;background:#f7f4ef;display:flex;align-items:center;justify-content:center;font-family:'DM Sans',sans-serif;padding:20px;}
    body::before{content:'';position:fixed;inset:0;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)' opacity='0.025'/%3E%3C/svg%3E");opacity:.6;pointer-events:none;}
    .card{position:relative;z-index:1;background:#fff;border:1px solid #e4ddd4;border-radius:20px;padding:48px 36px;text-align:center;max-width:420px;width:100%;box-shadow:0 8px 40px rgba(26,21,16,.1);}
    .card::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:var(--ac);border-radius:20px 20px 0 0;}
    .icon{font-size:52px;margin-bottom:20px;}
    h1{font-family:'Playfair Display',serif;font-size:26px;font-weight:700;color:var(--ac);margin-bottom:12px;}
    p{color:#6b6055;line-height:1.7;font-size:15px;}
    a{display:inline-block;margin-top:24px;color:#2c4a3e;text-decoration:none;font-family:'DM Mono',monospace;font-size:13px;border-bottom:1px solid rgba(44,74,62,.2);padding-bottom:2px;}
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
    const visitor  = visitors.find(v => v.visitor_id === visitorId);

    if (!visitor) {
      return res?.status(404).send(htmlPage('Not Found', { icon: '❓', text: 'Visitor record not found. The link may be expired or invalid.' }, '#c0392b'));
    }
    if (visitor.status === 'APPROVED') {
      return res?.status(200).send(htmlPage('Already Approved', { icon: '✅', text: `<strong>${visitor.visitor_name}</strong> was already approved. Pass has been sent.` }));
    }
    if (visitor.status === 'REJECTED') {
      return res?.status(200).send(htmlPage('Already Rejected', { icon: '❌', text: `<strong>${visitor.visitor_name}</strong> was already rejected.` }, '#c0392b'));
    }
    if (visitor.status !== 'PENDING') {
      return res?.status(200).send(htmlPage('Already Processed', { icon: 'ℹ️', text: `Status: <strong>${visitor.status}</strong>` }, '#6b6055'));
    }

    const BASE_URL    = getBaseUrl();
    const passLink    = `${BASE_URL}/pass/${visitorId}`;
    const approvalTime = new Date().toISOString();

    // Strip apostrophe prefix from phone numbers in case old records have it
    // Also strip + and spaces — WhatsApp API needs digits only (e.g. 918168879409)
    const cleanMobile = String(visitor.visitor_mobile).replace(/[^\d]/g, '');

    console.log('[Approval] BASE_URL:', BASE_URL);
    console.log('[Approval] Pass link:', passLink);
    console.log('[Approval] Visitor mobile raw:', visitor.visitor_mobile);
    console.log('[Approval] Visitor mobile clean:', cleanMobile);

    // Update sheet first
    await updateRowByColumn(VISITORS_SHEET, 'visitor_id', visitorId, {
      status: 'APPROVED',
      approval_time: approvalTime,
      pass_link: passLink,
    });

    console.log('[Approval] Sheet updated ✓');

    // Send pass via WhatsApp — use cleanMobile (digits only, no apostrophe/+)
    try {
      await sendPassToVisitor(cleanMobile, visitor, passLink);
      console.log('[Approval] ✅ Pass sent to', cleanMobile);
    } catch (waErr) {
      // Print the FULL Meta error so we can see exactly what's wrong
      const metaErr = waErr.response?.data?.error;
      console.error('[Approval] ❌ WhatsApp FAILED for', visitor.visitor_mobile);
      console.error('[Approval] Meta error code:', metaErr?.code);
      console.error('[Approval] Meta error type:', metaErr?.type);
      console.error('[Approval] Meta error message:', metaErr?.message);
      console.error('[Approval] Meta error fbtrace_id:', metaErr?.fbtrace_id);
      console.error('[Approval] Full response:', JSON.stringify(waErr.response?.data));
      // Don't fail the whole request — sheet is updated, pass link works
    }

    return res?.status(200).send(htmlPage('Visitor Approved ✓', {
      icon: '✅',
      text: `<strong>${visitor.visitor_name}</strong> has been approved.<br><br>Pass link: <a href="${passLink}" target="_blank" style="word-break:break-all;font-size:12px;">${passLink}</a>`,
    }));

  } catch (err) {
    console.error('[handleApproval] ERROR:', err.message);
    console.error('[handleApproval] Stack:', err.stack);
    return res?.status(500).send(htmlPage('Error', { icon: '⚠️', text: `Error: ${err.message}` }, '#c0392b'));
  }
}

async function handleRejection(visitorId, res) {
  try {
    const visitors = await getSheetData(VISITORS_SHEET);
    const visitor  = visitors.find(v => v.visitor_id === visitorId);

    if (!visitor) {
      return res?.status(404).send(htmlPage('Not Found', { icon: '❓', text: 'Visitor record not found.' }, '#c0392b'));
    }
    if (visitor.status !== 'PENDING') {
      return res?.status(200).send(htmlPage('Already Processed', { icon: 'ℹ️', text: `Status is already <strong>${visitor.status}</strong>.` }, '#6b6055'));
    }

    const cleanMobile = String(visitor.visitor_mobile).replace(/[^\d]/g, '');

    await updateRowByColumn(VISITORS_SHEET, 'visitor_id', visitorId, {
      status: 'REJECTED',
      approval_time: new Date().toISOString(),
    });

    try {
      await sendRejectionNotice(cleanMobile, visitor.visitor_name);
      console.log('[Rejection] Rejection notice sent to', cleanMobile);
    } catch (waErr) {
      const metaErr = waErr.response?.data?.error;
      console.error('[Rejection] ❌ WhatsApp FAILED:', JSON.stringify(metaErr || waErr.message));
    }

    return res?.status(200).send(htmlPage('Visitor Rejected', {
      icon: '❌',
      text: `<strong>${visitor.visitor_name}</strong> has been rejected.`,
    }, '#c0392b'));

  } catch (err) {
    console.error('[handleRejection] ERROR:', err.message);
    return res?.status(500).send(htmlPage('Error', { icon: '⚠️', text: err.message }, '#c0392b'));
  }
}

module.exports = { handleApproval, handleRejection };
