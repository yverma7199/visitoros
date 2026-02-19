// ─────────────────────────────────────────
// VISITOROS v2 — FRONTEND LOGIC
// ─────────────────────────────────────────
const API_BASE = '';

// ── PEOPLE DROPDOWN ──
let peopleData = [];
const personSelect    = document.getElementById('person_to_meet');
const reloadPeopleBtn = document.getElementById('reloadPeopleBtn');
const hintPerson      = document.getElementById('hint-person');

async function loadPeople() {
  personSelect.innerHTML = '<option value="">— Loading… —</option>';
  personSelect.disabled  = true;
  reloadPeopleBtn.style.display = 'none';
  hintPerson.textContent = '';

  try {
    const res  = await fetch(`${API_BASE}/people`, { method: 'GET', headers: { 'Accept': 'application/json' } });
    if (!res.ok) throw new Error(`Server error ${res.status}`);
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to load people');

    peopleData = data.people || [];
    if (peopleData.length === 0) {
      personSelect.innerHTML = '<option value="">— No people found —</option>';
      reloadPeopleBtn.style.display = 'block';
    } else {
      personSelect.innerHTML = '<option value="">— Select person to meet —</option>';
      peopleData.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.name;
        opt.dataset.mobile = p.whatsapp_number || p.mobile_number || '';
        opt.textContent = `${p.name}${p.designation ? ' — ' + p.designation : ''}`;
        personSelect.appendChild(opt);
      });
      hintPerson.textContent = `${peopleData.length} person${peopleData.length !== 1 ? 's' : ''} available`;
    }
  } catch (err) {
    personSelect.innerHTML = '<option value="">— Failed to load —</option>';
    hintPerson.textContent = '⚠️ Could not load. Click ↺ to retry.';
    reloadPeopleBtn.style.display = 'block';
    showToast('Could not load people list. Check backend connection.');
  } finally {
    personSelect.disabled = false;
  }
}

reloadPeopleBtn.addEventListener('click', () => loadPeople());
loadPeople();

// Default date
const visitDateInput = document.getElementById('visit_date');
visitDateInput.value = new Date().toISOString().split('T')[0];
visitDateInput.min   = new Date().toISOString().split('T')[0];

// ── PHOTO CAPTURE ──
let currentStream       = null;
let useFrontCamera      = true;
let capturedPhotoBase64 = '';

const photoPrompt      = document.getElementById('photoPrompt');
const cameraStep       = document.getElementById('cameraStep');
const photoPreviewStep = document.getElementById('photoPreviewStep');
const cameraVideo      = document.getElementById('cameraVideo');
const captureCanvas    = document.getElementById('captureCanvas');
const capturedPhotoImg = document.getElementById('capturedPhotoImg');
const photoBase64Input = document.getElementById('photo_base64');
const photoFileInput   = document.getElementById('photoFileInput');

function showPhotoStep(step) {
  [photoPrompt, cameraStep, photoPreviewStep].forEach(el => el.style.display = 'none');
  step.style.display = 'flex';
}

document.getElementById('openCameraBtn').addEventListener('click', () => startCamera());

async function startCamera(facingMode = null) {
  stopCamera();
  const facing = facingMode || (useFrontCamera ? 'user' : 'environment');
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: facing, width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false,
    });
    currentStream = stream;
    cameraVideo.srcObject = stream;
    showPhotoStep(cameraStep);
  } catch (err) {
    if (err.name === 'NotAllowedError') showToast('Camera access denied. Please allow camera permission.');
    else if (err.name === 'NotFoundError') { showToast('No camera found. Please upload a photo instead.'); photoFileInput.click(); }
    else showToast('Cannot access camera: ' + err.message);
  }
}

function stopCamera() {
  if (currentStream) { currentStream.getTracks().forEach(t => t.stop()); currentStream = null; }
}

document.getElementById('flipCameraBtn').addEventListener('click', () => {
  useFrontCamera = !useFrontCamera;
  startCamera(useFrontCamera ? 'user' : 'environment');
});
document.getElementById('cancelCameraBtn').addEventListener('click', () => { stopCamera(); showPhotoStep(photoPrompt); });

document.getElementById('captureBtn').addEventListener('click', () => {
  const video = cameraVideo;
  const canvas = captureCanvas;
  canvas.width  = video.videoWidth  || 640;
  canvas.height = video.videoHeight || 480;
  const ctx = canvas.getContext('2d');
  if (useFrontCamera) { ctx.translate(canvas.width, 0); ctx.scale(-1, 1); }
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  const maxW = 800;
  const scale = Math.min(1, maxW / canvas.width);
  const oc = document.createElement('canvas');
  oc.width = Math.round(canvas.width * scale);
  oc.height = Math.round(canvas.height * scale);
  oc.getContext('2d').drawImage(canvas, 0, 0, oc.width, oc.height);
  setPhoto(oc.toDataURL('image/jpeg', 0.85));
  stopCamera();
});

document.getElementById('uploadPhotoBtn').addEventListener('click', () => photoFileInput.click());
photoFileInput.addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const maxW = 800;
      const scale = Math.min(1, maxW / img.width);
      canvas.width  = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      setPhoto(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
  e.target.value = '';
});

function setPhoto(base64) {
  capturedPhotoBase64 = base64;
  photoBase64Input.value = base64;
  capturedPhotoImg.src = base64;
  document.getElementById('err-photo').textContent = '';
  showPhotoStep(photoPreviewStep);
}

document.getElementById('retakeBtn').addEventListener('click', () => {
  capturedPhotoBase64 = '';
  photoBase64Input.value = '';
  stopCamera();
  showPhotoStep(photoPrompt);
});

window.addEventListener('beforeunload', stopCamera);

// ── VALIDATION ──
const validators = {
  visitor_name:   v => v.trim().length >= 2 ? null : 'Enter at least 2 characters',
  visitor_mobile: v => /^\+?[0-9\s\-]{7,15}$/.test(v.trim()) ? null : 'Enter a valid mobile number',
  visitor_email:  v => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? null : 'Enter a valid email',
  purpose:        v => v ? null : 'Please select a purpose',
  person_to_meet: v => v ? null : 'Please select a person',
  visit_date:     v => v ? null : 'Please select a date',
  visit_time:     v => v ? null : 'Please select a time',
};
const errorIds = {
  visitor_name: 'err-name', visitor_mobile: 'err-mobile', visitor_email: 'err-email',
  purpose: 'err-purpose', person_to_meet: 'err-person', visit_date: 'err-date', visit_time: 'err-time',
};
function validateField(name, value) {
  const err   = validators[name]?.(value);
  const errEl = document.getElementById(errorIds[name]);
  const input = document.getElementById(name);
  if (errEl) errEl.textContent = err || '';
  if (input) input.classList.toggle('invalid', !!err);
  return err || null;
}
Object.keys(validators).forEach(name => {
  const el = document.getElementById(name);
  if (!el) return;
  el.addEventListener('blur',  () => validateField(name, el.value));
  el.addEventListener('input', () => { if (el.classList.contains('invalid')) validateField(name, el.value); });
});

// ── FORM SUBMIT ──
const form           = document.getElementById('visitorForm');
const submitBtn      = document.getElementById('submitBtn');
const btnLoader      = document.getElementById('btnLoader');
const successPanel   = document.getElementById('successPanel');
const successDetails = document.getElementById('successDetails');

form.addEventListener('submit', async e => {
  e.preventDefault();
  let hasError = false;
  Object.keys(validators).forEach(name => {
    const el = document.getElementById(name);
    if (el && validateField(name, el.value)) hasError = true;
  });
  if (!capturedPhotoBase64) {
    document.getElementById('err-photo').textContent = 'Please capture or upload a visitor photo';
    document.getElementById('photoCaptureArea').scrollIntoView({ behavior: 'smooth', block: 'center' });
    hasError = true;
  }
  if (hasError) { showToast('Please fix the highlighted errors before submitting.'); return; }

  const selectedOpt    = personSelect.options[personSelect.selectedIndex];
  const approverMobile = selectedOpt?.dataset.mobile || '';
  if (!approverMobile) { showToast('Could not find host contact number. Please re-select the person.'); return; }

  const payload = {
    visitor_name:    document.getElementById('visitor_name').value.trim(),
    visitor_mobile:  document.getElementById('visitor_mobile').value.trim(),
    visitor_email:   document.getElementById('visitor_email').value.trim(),
    purpose:         document.getElementById('purpose').value,
    person_to_meet:  document.getElementById('person_to_meet').value,
    approver_mobile: approverMobile,
    visit_date:      document.getElementById('visit_date').value,
    visit_time:      document.getElementById('visit_time').value,
    photo_base64:    capturedPhotoBase64,
  };

  setLoading(true);
  try {
    const res  = await fetch(`${API_BASE}/submit-visitor`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Submission failed');

    form.style.display = 'none';
    successDetails.innerHTML = `
      🆔 &nbsp;Visitor ID: <strong>${(data.visitor_id || '').slice(0,8).toUpperCase()}</strong><br>
      📱 &nbsp;Approval request → ${approverMobile}<br>
      📅 &nbsp;Visit: ${payload.visit_date} at ${payload.visit_time}
      ${data.photo_url ? '<br>📸 &nbsp;Photo saved ✓' : ''}
    `;
    successPanel.classList.add('visible');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (err) {
    showToast(err.message || 'Something went wrong. Please try again.');
  } finally {
    setLoading(false);
  }
});

function setLoading(state) {
  submitBtn.disabled = state;
  submitBtn.classList.toggle('loading', state);
  btnLoader.classList.toggle('visible', state);
}

let toastTimer;
function showToast(msg) {
  const toast = document.getElementById('errorToast');
  document.getElementById('toastMsg').textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 5000);
}

function resetForm() {
  form.reset();
  visitDateInput.value = new Date().toISOString().split('T')[0];
  capturedPhotoBase64 = '';
  photoBase64Input.value = '';
  showPhotoStep(photoPrompt);
  stopCamera();
  document.querySelectorAll('.field-error').forEach(el => el.textContent = '');
  document.querySelectorAll('.invalid').forEach(el => el.classList.remove('invalid'));
  form.style.display = 'flex';
  form.style.flexDirection = 'column';
  successPanel.classList.remove('visible');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  loadPeople();
}
