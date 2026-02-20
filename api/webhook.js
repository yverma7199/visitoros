// api/webhook.js — WhatsApp Cloud API Webhook Handler
// Handles: GET (verification) + POST (button reply events)
const { handleApproval, handleRejection } = require('./_approval');

module.exports = async (req, res) => {
  // ── GET: Webhook Verification ──
  if (req.method === 'GET') {
    const mode      = req.query['hub.mode'];
    const token     = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    console.log('[Webhook] Verification request:', { mode, token });

    if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
      console.log('[Webhook] ✅ Verified');
      return res.status(200).send(challenge);
    }
    console.error('[Webhook] ❌ Verification failed — token mismatch');
    return res.status(403).send('Forbidden');
  }

  // ── POST: Incoming Message / Button Reply ──
  if (req.method === 'POST') {
    try {
      const body = req.body;
      console.log('[Webhook] Incoming payload:', JSON.stringify(body, null, 2));

      // Validate it's a WhatsApp message event
      if (body.object !== 'whatsapp_business_account') {
        return res.status(200).send('OK'); // Always 200 to Meta or they retry
      }

      const entry    = body.entry?.[0];
      const changes  = entry?.changes?.[0];
      const value    = changes?.value;
      const messages = value?.messages;

      if (!messages || messages.length === 0) {
        console.log('[Webhook] No messages in payload — possibly a status update, ignoring');
        return res.status(200).send('OK');
      }

      const message = messages[0];
      console.log('[Webhook] Message type:', message.type);
      console.log('[Webhook] Message from:', message.from);

      // ── Handle button reply ──
      if (message.type === 'interactive' && message.interactive?.type === 'button_reply') {
        const buttonId    = message.interactive.button_reply.id;
        const buttonTitle = message.interactive.button_reply.title;
        const from        = message.from;

        console.log('[Webhook] Button pressed:', buttonId, '|', buttonTitle, '| from:', from);

        if (buttonId.startsWith('APPROVE_')) {
          const visitorId = buttonId.replace('APPROVE_', '');
          console.log('[Webhook] Processing APPROVAL for visitor:', visitorId);
          // Pass null as res — we handle response to Meta ourselves
          await handleApproval(visitorId, null);
          console.log('[Webhook] ✅ Approval processed');

        } else if (buttonId.startsWith('REJECT_')) {
          const visitorId = buttonId.replace('REJECT_', '');
          console.log('[Webhook] Processing REJECTION for visitor:', visitorId);
          await handleRejection(visitorId, null);
          console.log('[Webhook] ✅ Rejection processed');

        } else {
          console.warn('[Webhook] Unknown button ID:', buttonId);
        }
      } else if (message.type === 'text') {
        console.log('[Webhook] Text message received from', message.from, ':', message.text?.body);
        // Ignore text messages — only process button replies
      } else {
        console.log('[Webhook] Unhandled message type:', message.type);
      }

      // Always respond 200 OK to Meta within 20 seconds
      return res.status(200).send('OK');

    } catch (err) {
      console.error('[Webhook] ERROR processing:', err.message);
      console.error('[Webhook] Stack:', err.stack);
      // Still return 200 so Meta doesn't retry forever
      return res.status(200).send('OK');
    }
  }

  return res.status(405).send('Method Not Allowed');
};
