// api/webhook.js — WhatsApp Cloud API Webhook Handler
const { handleApproval, handleRejection } = require('./_approval');

// Vercel body parser config — named export required
const config = { api: { bodyParser: { sizeLimit: '1mb' } } };

async function handler(req, res) {

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

  if (req.method === 'POST') {
    // Respond 200 FIRST — Meta requires response within 5s
    res.status(200).send('OK');

    try {
      const body = req.body;
      console.log('[Webhook] POST body:', JSON.stringify(body));

      if (!body || body.object !== 'whatsapp_business_account') {
        console.log('[Webhook] Not a WA event:', body?.object);
        return;
      }

      for (const entry of (body.entry || [])) {
        for (const change of (entry.changes || [])) {
          const value = change.value || {};
          if (value.statuses?.length > 0) {
            console.log('[Webhook] Delivery status:', value.statuses[0].status);
          }
          for (const message of (value.messages || [])) {
            console.log('[Webhook] Message type:', message.type, '| from:', message.from);
            if (message.type === 'interactive' && message.interactive?.type === 'button_reply') {
              const buttonId = message.interactive.button_reply?.id || '';
              console.log('[Webhook] 🔘 Button clicked:', buttonId);
              if (buttonId.startsWith('APPROVE_')) {
                const visitorId = buttonId.slice('APPROVE_'.length);
                console.log('[Webhook] Approving visitor:', visitorId);
                await handleApproval(visitorId, null);
                console.log('[Webhook] ✅ Approval complete');
              } else if (buttonId.startsWith('REJECT_')) {
                const visitorId = buttonId.slice('REJECT_'.length);
                console.log('[Webhook] Rejecting visitor:', visitorId);
                await handleRejection(visitorId, null);
                console.log('[Webhook] ✅ Rejection complete');
              } else {
                console.warn('[Webhook] Unknown button ID:', buttonId);
              }
            } else {
              console.log('[Webhook] Non-button message type:', message.type);
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
