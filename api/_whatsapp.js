// api/_whatsapp.js — WhatsApp Cloud API helpers
const axios = require('axios');

function getBaseUrl() {
  if (process.env.BASE_URL && !process.env.BASE_URL.includes('localhost')) return process.env.BASE_URL;
  return 'https://visitoros.vercel.app';
}

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
    const metaError = err.response?.data?.error;
    console.error('[WA] ❌ Failed to send to', cleanTo);
    console.error('[WA] Meta error:', JSON.stringify(metaError || err.message));
    throw err;
  }
}

// Sends a WhatsApp text message with a link to the approver portal
// No interactive buttons = no webhook needed at all
async function sendApprovalRequest(approverMobile, visitor) {
  const to     = String(approverMobile).replace(/[^0-9]/g, '');
  const portal = `${getBaseUrl()}/approve-portal.html`;

  console.log('[WA] Sending approval request to:', to);

  return sendWhatsAppMessage(to, {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'text',
    text: {
      preview_url: false,
      body:
`🔔 *New Visitor Request*

*${visitor.visitor_name}* wants to visit you.

📱 Mobile: ${visitor.visitor_mobile}
🎯 Purpose: ${visitor.purpose}
📅 Date: ${visitor.visit_date} at ${visitor.visit_time}

👇 *Open portal to Approve or Reject:*
${portal}

_VisitorOS_`,
    },
  });
}

// Sends the visitor their pass as a PDF download link
async function sendPassToVisitor(visitorMobile, visitor, passLink) {
  const to     = String(visitorMobile).replace(/[^0-9]/g, '');
  const pdfUrl = `${passLink}?pdf=1`;
  console.log('[WA] Sending pass to visitor:', to);

  return sendWhatsAppMessage(to, {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'text',
    text: {
      preview_url: false,
      body:
`✅ *Visit Approved!*

Hello *${visitor.visitor_name}*, your visit has been approved.

📅 Date: ${visitor.visit_date}
🕐 Time: ${visitor.visit_time}

📄 *Download Entry Pass (PDF):*
${pdfUrl}

Open the link → tap *Download PDF* → show at security gate.

_Valid for date of visit only · VisitorOS_`,
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
      body: `❌ *Visit Request Rejected*\n\nHello ${visitorName},\n\nYour visit request has been rejected by the host. Please contact them directly.\n\n_VisitorOS_`,
    },
  });
}

module.exports = { sendApprovalRequest, sendPassToVisitor, sendRejectionNotice };
