// api/scan.js
const { getSheetData, updateRowByColumn, setCors, VISITORS_SHEET } = require('./_sheets');

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

  try {
    const { qr_data } = req.body;
    if (!qr_data) return res.status(400).json({ success: false, error: 'qr_data is required' });

    let parsed;
    try { parsed = JSON.parse(qr_data); }
    catch { return res.status(400).json({ success: false, error: 'Invalid QR code. Cannot parse JSON.' }); }

    const { visitor_id } = parsed;
    if (!visitor_id) return res.status(400).json({ success: false, error: 'QR code missing visitor_id.' });

    const visitors = await getSheetData(VISITORS_SHEET);
    const visitor  = visitors.find(v => v.visitor_id === visitor_id);

    if (!visitor) return res.status(404).json({ success: false, error: '⚠️ Visitor not found. Invalid QR.' });
    if (visitor.status !== 'APPROVED') {
      return res.status(403).json({ success: false, error: `⛔ Entry denied. Visitor status: ${visitor.status}` });
    }
    if (visitor.scan_status === 'SCANNED') {
      return res.status(409).json({
        success: false,
        error: `🚫 Duplicate scan! This pass was already used at ${new Date(visitor.scan_time).toLocaleString('en-IN')}.`,
        scan_time: visitor.scan_time,
      });
    }

    const scanTime = new Date().toISOString();
    await updateRowByColumn(VISITORS_SHEET, 'visitor_id', visitor_id, {
      scan_status: 'SCANNED',
      scan_time: scanTime,
    });

    return res.status(200).json({
      success: true,
      message: '✅ Entry Granted',
      visitor: {
        name: visitor.visitor_name,
        mobile: visitor.visitor_mobile,
        email: visitor.visitor_email,
        purpose: visitor.purpose,
        person_to_meet: visitor.person_to_meet,
        visit_date: visitor.visit_date,
        visit_time: visitor.visit_time,
        photo_url: visitor.photo_url,
        scan_time: scanTime,
      },
    });
  } catch (err) {
    console.error('[/scan]', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
};
