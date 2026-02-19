// api/webhook.js
const { setCors } = require('./_sheets');
const { handleApproval, handleRejection } = require('./_approval');

module.exports = async (req, res) => {
  setCors(res);

  // ── GET: Webhook verification from Meta ──
  if (req.method === 'GET') {
    const mode      = req.query['hub.mode'];
    const token     = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
      console.log('[Webhook] Verified ✅');
      return res.status(200).send(challenge);
    }
    console.warn('[Webhook] Verification failed — token mismatch');
    return res.status(403).send('Forbidden');
  }

  // ── POST: Incoming messages from WhatsApp ──
  if (req.method === 'POST') {
    // Always respond 200 immediately so Meta doesn't retry
    res.status(200).end();

    try {
      const body = req.body;
      if (body?.object !== 'whatsapp_business_account') return;

      const message = body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
      if (!message) return;

      // Handle interactive button replies
      if (message.type === 'interactive') {
        const buttonId = message.interactive?.button_reply?.id || '';
        console.log('[Webhook] Button clicked:', buttonId);

        if (buttonId.startsWith('APPROVE_')) {
          const visitorId = buttonId.replace('APPROVE_', '');
          await handleApproval(visitorId, null);
        } else if (buttonId.startsWith('REJECT_')) {
          const visitorId = buttonId.replace('REJECT_', '');
          await handleRejection(visitorId, null);
        }
      }
    } catch (err) {
      console.error('[Webhook] Processing error:', err.message);
    }
    return;
  }

  return res.status(405).end('Method not allowed');
};
