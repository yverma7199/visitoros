// api/webhook.js — WhatsApp Cloud API Webhook Handler
const { handleApproval, handleRejection } = require('./_approval');

// ─────────────────────────────────────────
// CRITICAL: Tell Vercel NOT to pre-parse the body
// Meta sends JSON but Vercel sometimes mangles it
// We parse it ourselves to guarantee correctness
// ─────────────────────────────────────────
module.exports.config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
};

module.exports = async (req, res) => {

  // ── GET: Webhook Verification ──
  if (req.method === 'GET') {
    const mode      = req.query['hub.mode'];
    const token     = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    console.log('[Webhook] Verification:', { mode, token: token?.slice(0,10), challenge });

    if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
      console.log('[Webhook] ✅ Verified successfully');
      return res.status(200).send(challenge);
    }
    console.error('[Webhook] ❌ Token mismatch. Expected:', process.env.WHATSAPP_VERIFY_TOKEN, 'Got:', token);
    return res.status(403).send('Forbidden');
  }

  // ── POST: Incoming events from Meta ──
  if (req.method === 'POST') {
    // Always respond 200 immediately so Meta doesn't retry
    // Process async after responding
    res.status(200).send('OK');

    try {
      const body = req.body;

      // Log the full payload for debugging
      console.log('[Webhook] Raw payload:', JSON.stringify(body));

      if (!body || body.object !== 'whatsapp_business_account') {
        console.log('[Webhook] Not a WhatsApp event, object:', body?.object);
        return;
      }

      const entries = body.entry || [];
      for (const entry of entries) {
        const changes = entry.changes || [];
        for (const change of changes) {
          const value    = change.value || {};
          const messages = value.messages || [];

          // Log statuses (delivery receipts) separately
          if (value.statuses?.length > 0) {
            console.log('[Webhook] Status update:', JSON.stringify(value.statuses[0]));
          }

          for (const message of messages) {
            console.log('[Webhook] Message received:', {
              type: message.type,
              from: message.from,
              id: message.id,
            });

            // ── Button reply (Approve / Reject) ──
            if (message.type === 'interactive' && message.interactive?.type === 'button_reply') {
              const buttonId    = message.interactive.button_reply?.id || '';
              const buttonTitle = message.interactive.button_reply?.title || '';

              console.log('[Webhook] 🔘 Button clicked:', { buttonId, buttonTitle, from: message.from });

              if (buttonId.startsWith('APPROVE_')) {
                const visitorId = buttonId.slice('APPROVE_'.length);
                console.log('[Webhook] Processing APPROVAL for:', visitorId);
                await handleApproval(visitorId, null);
                console.log('[Webhook] ✅ Approval done for:', visitorId);

              } else if (buttonId.startsWith('REJECT_')) {
                const visitorId = buttonId.slice('REJECT_'.length);
                console.log('[Webhook] Processing REJECTION for:', visitorId);
                await handleRejection(visitorId, null);
                console.log('[Webhook] ✅ Rejection done for:', visitorId);

              } else {
                console.warn('[Webhook] Unknown button ID:', buttonId);
              }

            } else if (message.type === 'text') {
              console.log('[Webhook] Text from', message.from, ':', message.text?.body);

            } else {
              console.log('[Webhook] Unhandled message type:', message.type);
            }
          }
        }
      }

    } catch (err) {
      console.error('[Webhook] Processing error:', err.message);
      console.error('[Webhook] Stack:', err.stack);
    }
    return;
  }

  return res.status(405).send('Method Not Allowed');
};
