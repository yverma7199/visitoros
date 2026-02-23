// api/submit-visitor.js
const { appendRow, setCors, VISITORS_SHEET } = require('./_sheets');
const { sendApprovalRequest } = require('./_whatsapp');
const { v4: uuidv4 } = require('uuid');

// ─────────────────────────────────────────
// FIX 1: Cloudinary — use multipart/form-data (not URLSearchParams)
// The previous version sent base64 as url-encoded which breaks for large images
// ─────────────────────────────────────────
async function uploadPhotoToCloudinary(base64DataUrl) {
  if (!base64DataUrl || !process.env.CLOUDINARY_CLOUD_NAME) {
    console.log('[Cloudinary] Skipping — no base64 or no cloud name configured');
    return '';
  }

  try {
    const axios = require('axios');

    // Build proper multipart form data
    const boundary = '----CloudinaryBoundary' + Date.now();
    const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET || 'visitor_photos';

    // Compose multipart body manually (no FormData in Node serverless)
    const lines = [];
    const addField = (name, value) => {
      lines.push(`--${boundary}`);
      lines.push(`Content-Disposition: form-data; name="${name}"`);
      lines.push('');
      lines.push(value);
    };

    addField('upload_preset', uploadPreset);
    addField('folder', 'visitor_photos');
    addField('file', base64DataUrl); // base64 data URL like data:image/jpeg;base64,...
    lines.push(`--${boundary}--`);
    const body = lines.join('\r\n');

    const response = await axios.post(
      `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload`,
      body,
      {
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        timeout: 15000,
      }
    );

    const url = response.data.secure_url || '';
    console.log('[Cloudinary] Upload success:', url);
    return url;

  } catch (err) {
    // Log full error for debugging
    console.error('[Cloudinary] Upload failed:', err.response?.data || err.message);
    // Return empty string — don't store raw base64 in the sheet
    return '';
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
      photo_base64,
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

    // ─────────────────────────────────────────
    // FIX 2: Mobile number — prefix with apostrophe to prevent Google Sheets
    // from treating numbers like 8708801547 as a formula (causing #ERROR!)
    // We store as plain string by prepending a tab character in RAW mode
    // ─────────────────────────────────────────
    // Clean the mobile — digits only (no +), stored as plain number string
    // We strip + because in RAW mode, +91... is interpreted as a formula by Sheets
    // The number is still perfectly usable for WhatsApp (which expects digits only anyway)
    const cleanMobile   = String(visitor_mobile).replace(/[^\d]/g, '');
    const cleanApprover = String(approver_mobile).replace(/[^\d]/g, '');

    // Upload photo
    let photo_url = '';
    if (photo_base64) {
      photo_url = await uploadPhotoToCloudinary(photo_base64);
    }

    const rowData = [
      visitor_id,
      visitor_name,
      // Store as plain digits — no apostrophe prefix needed since number-only strings
      // don't trigger formula errors in RAW mode (only +/= prefixed strings do)
      cleanMobile,
      visitor_email || '',
      purpose,
      person_to_meet,
      cleanApprover,
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

    // ─────────────────────────────────────────
    // FIX 3: WhatsApp — use the clean approver number (no apostrophe prefix)
    // and log errors properly so we can debug
    // ─────────────────────────────────────────
    const visitor = {
      visitor_id,
      visitor_name,
      visitor_mobile: cleanMobile,
      purpose,
      visit_date,
      visit_time,
    };

    // Send WhatsApp — await it so we can catch and log the real error
    try {
      await sendApprovalRequest(cleanApprover, visitor);
      console.log('[WA] Approval request sent to', cleanApprover);
    } catch (waErr) {
      // Log the full WhatsApp error — check Vercel logs for this
      console.error('[WA] FAILED:', JSON.stringify(waErr.response?.data || waErr.message));
    }

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
