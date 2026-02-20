// api/debug-wa.js — TEMPORARY DEBUG ENDPOINT
// Use this to diagnose WhatsApp issues
// DELETE THIS FILE after fixing!
// Access: https://visitoros.vercel.app/debug-wa?to=91XXXXXXXXXX

const axios = require('axios');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  const to = req.query.to; // Pass phone number like 918168879409

  const results = {};

  // ── 1. Check env vars ──
  results.env = {
    WHATSAPP_PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID || 'MISSING',
    WHATSAPP_ACCESS_TOKEN: process.env.WHATSAPP_ACCESS_TOKEN
      ? `${process.env.WHATSAPP_ACCESS_TOKEN.slice(0, 20)}... (${process.env.WHATSAPP_ACCESS_TOKEN.length} chars)`
      : 'MISSING',
    WHATSAPP_BUSINESS_ACCOUNT_ID: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || 'MISSING',
    VERCEL_URL: process.env.VERCEL_URL || 'NOT SET',
    BASE_URL: process.env.BASE_URL || 'NOT SET',
  };

  // ── 2. Validate token with Meta ──
  try {
    const tokenCheck = await axios.get(
      `https://graph.facebook.com/v19.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}`,
      { headers: { Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}` } }
    );
    results.token_valid = true;
    results.phone_number_info = tokenCheck.data;
  } catch (err) {
    results.token_valid = false;
    results.token_error = err.response?.data?.error || err.message;
  }

  // ── 3. Send test message if ?to= provided ──
  if (to) {
    try {
      const msgRes = await axios.post(
        `https://graph.facebook.com/v19.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
        {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: String(to).replace(/[^0-9]/g, ''),
          type: 'text',
          text: { body: '✅ VisitorOS test message. WhatsApp is working!' },
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
          },
        }
      );
      results.test_message = { success: true, response: msgRes.data };
    } catch (err) {
      results.test_message = {
        success: false,
        error: err.response?.data?.error || err.message,
        full_response: err.response?.data,
      };
    }
  } else {
    results.test_message = 'Add ?to=91XXXXXXXXXX to send a test message';
  }

  return res.status(200).json(results);
};
