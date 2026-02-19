// api/reject.js
const { setCors } = require('./_sheets');
const { handleRejection } = require('./_approval');

module.exports = async (req, res) => {
  setCors(res);
  const visitorId = req.query.visitorId || req.url.split('/').pop();
  await handleRejection(visitorId, res);
};
