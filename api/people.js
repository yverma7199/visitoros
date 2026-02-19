// api/people.js
const { getSheetData, setCors, PEOPLE_SHEET } = require('./_sheets');

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ success: false, error: 'Method not allowed' });

  try {
    const people = await getSheetData(PEOPLE_SHEET);
    const active = people.filter(p => (p.active || '').toUpperCase() === 'YES');
    return res.status(200).json({ success: true, people: active });
  } catch (err) {
    console.error('[/people]', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
};
