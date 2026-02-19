// api/_whatsapp.js — WhatsApp Cloud API helpers
const axios = require('axios');

const BASE_URL = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : (process.env.BASE_URL || 'http://localhost:3000');

async function sendWhatsAppMessage(to, payload) {
  const cleanTo = String(to).replace(/[^0-9]/g, '');
  const url = `https://graph.facebook.com/v19.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  const response = await axios.post(url, payload, {
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
  });
  console.log('[WA] sent to', cleanTo, response.data);
  return response.data;
}

async function sendApprovalRequest(approverMobile, visitor) {
  const to = String(approverMobile).replace(/[^0-9]/g, '');
  // WhatsApp button IDs max 256 chars, but button title max 20 chars
  const visitorIdShort = visitor.visitor_id; // full UUID needed for lookup
  return sendWhatsAppMessage(to, {
    messaging_product: 'whatsapp',
    to,
    type: 'interactive',
    interactive: {
      type: 'button',
      header: {
        type: 'text',
        text: '🔔 Visitor Approval Request',
      },
      body: {
        text: `👤 *${visitor.visitor_name}*\n📱 ${visitor.visitor_mobile}\n🎯 ${visitor.purpose}\n📅 ${visitor.visit_date} at ${visitor.visit_time}\n\nPlease APPROVE or REJECT this visitor.`,
      },
      footer: { text: 'VisitorOS — Tap a button to respond' },
      action: {
        buttons: [
          { type: 'reply', reply: { id: `APPROVE_${visitorIdShort}`, title: 'Approve ✅' } },
          { type: 'reply', reply: { id: `REJECT_${visitorIdShort}`,  title: 'Reject ❌'  } },
        ],
      },
    },
  });
}

async function sendPassToVisitor(visitorMobile, visitor, passLink) {
  const to = String(visitorMobile).replace(/[^0-9]/g, '');
  return sendWhatsAppMessage(to, {
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: {
      body: `✅ *Your Visit Has Been APPROVED!*\n\n👤 ${visitor.visitor_name}\n📅 ${visitor.visit_date} at ${visitor.visit_time}\n\n🎟️ *Your Entry Pass:*\n${passLink}\n\nShow the QR code at the security gate.\n_Valid for today only._`,
    },
  });
}

async function sendRejectionNotice(visitorMobile, visitorName) {
  const to = String(visitorMobile).replace(/[^0-9]/g, '');
  return sendWhatsAppMessage(to, {
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: {
      body: `❌ *Visit Request Rejected*\n\nHello ${visitorName},\n\nYour visit request has been rejected. Please contact the concerned person directly.\n\n_Thank you._`,
    },
  });
}

module.exports = { sendApprovalRequest, sendPassToVisitor, sendRejectionNotice };
