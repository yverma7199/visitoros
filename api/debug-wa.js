// api/debug-wa.js — TEMPORARY DEBUG — DELETE AFTER FIXING
const axios = require('axios');
const { sendApprovalRequest } = require('./_whatsapp');
const { getSheetData, VISITORS_SHEET } = require('./_sheets');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  const results = {};

  results.env = {
    WHATSAPP_PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID || 'MISSING',
    WHATSAPP_ACCESS_TOKEN: process.env.WHATSAPP_ACCESS_TOKEN
      ? `${process.env.WHATSAPP_ACCESS_TOKEN.slice(0,20)}... (${process.env.WHATSAPP_ACCESS_TOKEN.length} chars)` : 'MISSING',
    VERCEL_URL: process.env.VERCEL_URL || 'NOT SET',
    BASE_URL: process.env.BASE_URL || 'NOT SET',
  };

  // Test plain text message
  const to = req.query.to;
  if (to) {
    try {
      const r = await axios.post(
        `https://graph.facebook.com/v19.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
        { messaging_product:'whatsapp', recipient_type:'individual', to: String(to).replace(/[^0-9]/g,''), type:'text', text:{ body:'✅ VisitorOS test message!' } },
        { headers:{ Authorization:`Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`, 'Content-Type':'application/json' } }
      );
      results.text_message = { success: true, msg_id: r.data?.messages?.[0]?.id };
    } catch (err) {
      results.text_message = { success: false, error: err.response?.data?.error || err.message };
    }
  }

  // Test approval button message
  const approvalTo = req.query.approval_to;
  if (approvalTo) {
    const fakeVisitor = {
      visitor_id: 'debug-test-id-12345678',
      visitor_name: 'Test Visitor',
      visitor_mobile: approvalTo,
      purpose: 'Debug Test',
      visit_date: new Date().toISOString().split('T')[0],
      visit_time: '10:00',
    };
    try {
      await sendApprovalRequest(approvalTo, fakeVisitor);
      results.approval_button_message = { success: true };
    } catch (err) {
      results.approval_button_message = {
        success: false,
        meta_error: err.response?.data?.error,
        raw: err.response?.data,
      };
    }
  }

  // Show last 3 visitors from sheet
  if (req.query.show_visitors) {
    try {
      const visitors = await getSheetData(VISITORS_SHEET);
      results.last_3_visitors = visitors.slice(-3).map(v => ({
        name: v.visitor_name,
        status: v.status,
        visitor_mobile: v.visitor_mobile,
        approver_mobile: v.approver_mobile,
      }));
    } catch (err) {
      results.visitors_error = err.message;
    }
  }

  return res.status(200).json(results);
};
