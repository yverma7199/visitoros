// api/_whatsapp.js — WhatsApp Cloud API helpers
const axios = require('axios');

async function sendWhatsAppMessage(to, payload) {
  const cleanTo = String(to).replace(/[^0-9]/g, '');
  const url = `https://graph.facebook.com/v19.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;

  try {
    const response = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });
    console.log('[WA] ✅ Sent to', cleanTo, '| msg_id:', response.data?.messages?.[0]?.id);
    return response.data;
  } catch (err) {
    // Log the detailed Meta error so it shows in Vercel function logs
    const metaError = err.response?.data?.error;
    console.error('[WA] ❌ Failed to send to', cleanTo);
    console.error('[WA] Meta error:', JSON.stringify(metaError || err.message));
    throw err;
  }
}

async function sendApprovalRequest(approverMobile, visitor) {
  const to = String(approverMobile).replace(/[^0-9]/g, '');

  // WhatsApp button title max = 20 characters (enforced strictly by Meta)
  // "Approve ✅" = 10 chars ✓   "Reject ❌" = 9 chars ✓

  // Button ID max = 256 chars. UUID = 36 chars, prefix = 8 chars → 44 total ✓

  console.log('[WA] Sending approval request to:', to);
  console.log('[WA] Visitor ID:', visitor.visitor_id);
  console.log('[WA] Using Phone Number ID:', process.env.WHATSAPP_PHONE_NUMBER_ID);

  return sendWhatsAppMessage(to, {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'interactive',
    interactive: {
      type: 'button',
      header: {
        type: 'text',
        text: 'Visitor Approval',
      },
      body: {
        text: `New visitor request:\n\n*${visitor.visitor_name}*\nMobile: ${visitor.visitor_mobile}\nPurpose: ${visitor.purpose}\nDate: ${visitor.visit_date} at ${visitor.visit_time}\n\nPlease approve or reject.`,
      },
      footer: {
        text: 'VisitorOS',
      },
      action: {
        buttons: [
          {
            type: 'reply',
            reply: {
              id: `APPROVE_${visitor.visitor_id}`,
              title: 'Approve',
            },
          },
          {
            type: 'reply',
            reply: {
              id: `REJECT_${visitor.visitor_id}`,
              title: 'Reject',
            },
          },
        ],
      },
    },
  });
}

async function sendPassToVisitor(visitorMobile, visitor, passLink) {
  const to = String(visitorMobile).replace(/[^0-9]/g, '');
  console.log('[WA] Sending pass to visitor:', to);

  return sendWhatsAppMessage(to, {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'text',
    text: {
      body: `✅ Visit Approved!\n\nHello ${visitor.visitor_name},\nYour visit has been approved.\n\nDate: ${visitor.visit_date}\nTime: ${visitor.visit_time}\n\nYour entry pass:\n${passLink}\n\nShow QR code at security gate.\n_Valid for today only._`,
    },
  });
}

async function sendRejectionNotice(visitorMobile, visitorName) {
  const to = String(visitorMobile).replace(/[^0-9]/g, '');
  console.log('[WA] Sending rejection to visitor:', to);

  return sendWhatsAppMessage(to, {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'text',
    text: {
      body: `❌ Visit Request Rejected\n\nHello ${visitorName},\n\nYour visit request has been rejected. Please contact the concerned person directly.\n\nThank you.`,
    },
  });
}

module.exports = { sendApprovalRequest, sendPassToVisitor, sendRejectionNotice };
