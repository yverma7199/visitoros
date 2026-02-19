// api/submit-visitor.js
const { appendRow, setCors, VISITORS_SHEET } = require('./_sheets');
const { sendApprovalRequest } = require('./_whatsapp');
const { v4: uuidv4 } = require('uuid');

// Upload base64 photo to Cloudinary
async function uploadPhotoToCloudinary(base64DataUrl) {
  if (!base64DataUrl || !process.env.CLOUDINARY_CLOUD_NAME) return '';
  try {
    const axios = require('axios');
    const formData = new URLSearchParams();
    formData.append('file', base64DataUrl);
    formData.append('upload_preset', process.env.CLOUDINARY_UPLOAD_PRESET || 'visitor_photos');
    formData.append('folder', 'visitor_photos');

    const response = await axios.post(
      `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload`,
      formData.toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    return response.data.secure_url || '';
  } catch (err) {
    console.error('[Cloudinary] Upload failed:', err.message);
    return base64DataUrl.substring(0, 100) + '... (upload failed)';
  }
}

module.exports = async (req, res) => {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

  try {
    const {
      visitor_name,
      visitor_mobile,
      visitor_email,
      purpose,
      person_to_meet,
      approver_mobile,
      visit_date,
      visit_time,
      photo_base64, // NEW: base64 image from camera
    } = req.body;

    // Validate required fields
    const missing = [];
    if (!visitor_name)    missing.push('visitor_name');
    if (!visitor_mobile)  missing.push('visitor_mobile');
    if (!purpose)         missing.push('purpose');
    if (!person_to_meet)  missing.push('person_to_meet');
    if (!approver_mobile) missing.push('approver_mobile');
    if (!visit_date)      missing.push('visit_date');
    if (!visit_time)      missing.push('visit_time');
    if (missing.length > 0) {
      return res.status(400).json({ success: false, error: `Missing fields: ${missing.join(', ')}` });
    }

    const visitor_id = uuidv4();

    // Upload photo to Cloudinary (async, doesn't block if fails)
    let photo_url = '';
    if (photo_base64) {
      photo_url = await uploadPhotoToCloudinary(photo_base64);
    }

    const rowData = [
      visitor_id,
      visitor_name,
      visitor_mobile,
      visitor_email || '',
      purpose,
      person_to_meet,
      approver_mobile,
      visit_date,
      visit_time,
      photo_url,
      'PENDING',
      '',              // approval_time
      '',              // pass_link
      '',              // qr_data
      'NOT_SCANNED',   // scan_status
      '',              // scan_time
    ];

    await appendRow(VISITORS_SHEET, rowData);

    // Fire WhatsApp approval (non-blocking)
    const visitor = { visitor_id, visitor_name, visitor_mobile, purpose, visit_date, visit_time };
    sendApprovalRequest(approver_mobile, visitor).catch(err => {
      console.error('[WA] approval send failed:', err.message);
    });

    return res.status(200).json({
      success: true,
      message: 'Visitor registered. Approval request sent to host.',
      visitor_id,
      photo_url,
    });
  } catch (err) {
    console.error('[/submit-visitor]', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
};
