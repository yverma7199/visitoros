// api/webhook.js — WhatsApp Cloud API Webhook Handler
const { handleApproval, handleRejection } = require('./_approval');

// Vercel body parser config — MUST be a separate named export
const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
};

async function handler(req, res) {

  // ── GET: Webhook Verification ──
  if (req.method === 'GET') {
    const mode      = req.query['hub.mode'];
    const token     = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    console.log('[Webhook] Verification:', { mode, token });
    if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
      console.log('[Webhook] ✅ Verified');
      return res.status(200).send(challenge);
    }
    console.error('[Webhook] ❌ Token mismatch. Expected:', process.env.WHATSAPP_VERIFY_TOKEN, '| Got:', token);
    return res.status(403).send('Forbidden');
  }

  // ── POST: Button reply / incoming message ──
  if (req.method === 'POST') {
    // Respond 200 IMMEDIATELY — Meta needs response within 5s or retries
    res.status(200).send('OK');

    try {
      const body = req.body;
      console.log('[Webhook] POST received:', JSON.stringify(body));

      if (!body || body.object !== 'whatsapp_business_account') {
        console.log('[Webhook] Not a WA event, ignoring. object =', body?.object);
        return;
      }

      for (const entry of (body.entry || [])) {
        for (const change of (entry.changes || [])) {
          const value = change.value || {};

          if (value.statuses?.length > 0) {
            console.log('[Webhook] Status:', value.statuses[0].status, value.statuses[0].id);
          }

          for (const message of (value.messages || [])) {
            console.log('[Webhook] Message type:', message.type, '| from:', message.from);

            if (message.type === 'interactive' && message.interactive?.type === 'button_reply') {
              const buttonId = message.interactive.button_reply?.id || '';
              console.log('[Webhook] 🔘 Button:', buttonId, '| from:', message.from);

              if (buttonId.startsWith('APPROVE_')) {
                const visitorId = buttonId.slice('APPROVE_'.length);
                console.log('[Webhook] Approving:', visitorId);
                await handleApproval(visitorId, null);
                console.log('[Webhook] ✅ Approved:', visitorId);

              } else if (buttonId.startsWith('REJECT_')) {
                const visitorId = buttonId.slice('REJECT_'.length);
                console.log('[Webhook] Rejecting:', visitorId);
                await handleRejection(visitorId, null);
                console.log('[Webhook] ✅ Rejected:', visitorId);

              } else {
                console.warn('[Webhook] Unknown button ID:', buttonId);
              }

            } else {
              console.log('[Webhook] Ignoring message type:', message.type);
            }
          }
        }
      }
    } catch (err) {
      console.error('[Webhook] Error:', err.message, err.stack);
    }
    return;
  }

  return res.status(405).send('Method Not Allowed');
}

module.exports = handler;
module.exports.config = config;
