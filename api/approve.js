// api/approve.js
const { setCors } = require('./_sheets');
const { handleApproval } = require('./_approval');

module.exports = async (req, res) => {
  setCors(res);
  // visitorId comes from URL segment via vercel.json rewrite
  const visitorId = req.query.visitorId || req.url.split('/').pop();
  await handleApproval(visitorId, res);
};
