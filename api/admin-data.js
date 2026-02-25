// api/admin-data.js — Returns all visitors as JSON for the approver portal
const { getSheetData, setCors, VISITORS_SHEET } = require('./_sheets');

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  try {
    const visitors = await getSheetData(VISITORS_SHEET);
    // Sort newest first
    visitors.sort((a, b) =>
      new Date(b.visit_date + ' ' + (b.visit_time || '00:00')) -
      new Date(a.visit_date + ' ' + (a.visit_time || '00:00'))
    );
    return res.status(200).json({ success: true, visitors });
  } catch (err) {
    console.error('[admin-data]', err.message, err.stack);
    return res.status(500).json({ success: false, error: err.message });
  }
};
