// api/admin.js
const { getSheetData, setCors, VISITORS_SHEET } = require('./_sheets');

module.exports = async (req, res) => {
  setCors(res);
  try {
    const visitors = await getSheetData(VISITORS_SHEET);
    // Sort by most recent first (visit_date desc)
    visitors.sort((a, b) => new Date(b.visit_date) - new Date(a.visit_date));

    const photoCell = v => v.photo_url
      ? `<img src="${v.photo_url}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;">`
      : `<div style="width:36px;height:36px;border-radius:50%;background:#1e1e2e;display:flex;align-items:center;justify-content:center;font-size:16px;">👤</div>`;

    const rows = visitors.map(v => `
      <tr>
        <td>${photoCell(v)}</td>
        <td><strong>${v.visitor_name}</strong></td>
        <td>${v.visitor_mobile}</td>
        <td>${v.person_to_meet}</td>
        <td>${v.purpose}</td>
        <td>${v.visit_date} ${v.visit_time}</td>
        <td><span class="badge badge-${(v.status||'').toLowerCase()}">${v.status||'—'}</span></td>
        <td><span class="badge badge-${v.scan_status==='SCANNED'?'scanned':'ns'}">${v.scan_status||'—'}</span></td>
        <td style="font-size:11px;color:#6b6b8a">${v.scan_time ? new Date(v.scan_time).toLocaleString('en-IN') : '—'}</td>
      </tr>`).join('');

    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>VisitorOS Admin</title>
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600&family=Syne+Mono&display=swap" rel="stylesheet">
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{background:#080810;color:#e2e2f0;font-family:'Space Grotesk',sans-serif;min-height:100vh;padding:24px}
    .header{display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;flex-wrap:wrap;gap:12px}
    h1{font-size:22px;font-weight:700;letter-spacing:-0.5px}
    .meta{font-size:12px;color:#6b6b8a;font-family:'Syne Mono',monospace}
    .stats{display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap}
    .stat{background:#0f0f1a;border:1px solid #1e1e2e;border-radius:10px;padding:12px 20px;min-width:100px}
    .stat-num{font-size:26px;font-weight:700}
    .stat-lbl{font-size:11px;color:#6b6b8a;font-family:'Syne Mono',monospace;text-transform:uppercase;letter-spacing:1px}
    .stat.pending .stat-num{color:#f0e05a}
    .stat.approved .stat-num{color:#5af07c}
    .stat.rejected .stat-num{color:#f05a5a}
    .stat.scanned .stat-num{color:#7c6af0}
    .table-wrap{overflow-x:auto;border-radius:14px;border:1px solid #1e1e2e}
    table{width:100%;border-collapse:collapse;background:#0f0f1a;min-width:800px}
    th{background:#080810;color:#6b6b8a;padding:10px 14px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:1.5px;font-family:'Syne Mono',monospace;border-bottom:1px solid #1e1e2e}
    td{padding:12px 14px;border-bottom:1px solid #0f0f18;font-size:13px;vertical-align:middle}
    tr:last-child td{border-bottom:none}
    tr:hover td{background:#14141f}
    .badge{padding:3px 10px;border-radius:20px;font-size:10px;font-weight:700;font-family:'Syne Mono',monospace;letter-spacing:0.5px}
    .badge-approved{background:rgba(90,240,124,0.12);color:#5af07c}
    .badge-rejected{background:rgba(240,90,90,0.12);color:#f05a5a}
    .badge-pending{background:rgba(240,224,90,0.12);color:#f0e05a}
    .badge-scanned{background:rgba(124,106,240,0.12);color:#7c6af0}
    .badge-ns{background:#1e1e2e;color:#6b6b8a}
    .refresh{background:#1e1e2e;border:none;color:#9ca3af;padding:8px 16px;border-radius:8px;font-family:'Space Grotesk',sans-serif;font-size:13px;cursor:pointer;display:flex;align-items:center;gap:6px}
    .refresh:hover{background:#2d2d3d;color:#e2e2f0}
    a.back{color:#7c6af0;font-size:13px;text-decoration:none}
    .empty{text-align:center;padding:40px;color:#3d3d55;font-family:'Syne Mono',monospace;font-size:13px}
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>📋 Visitor Log</h1>
      <div class="meta">Last refreshed: ${new Date().toLocaleString('en-IN')}</div>
    </div>
    <div style="display:flex;gap:10px;align-items:center">
      <a class="back" href="/">← Registration Form</a>
      <button class="refresh" onclick="location.reload()">↺ Refresh</button>
    </div>
  </div>

  <div class="stats">
    <div class="stat pending"><div class="stat-num">${visitors.filter(v=>v.status==='PENDING').length}</div><div class="stat-lbl">Pending</div></div>
    <div class="stat approved"><div class="stat-num">${visitors.filter(v=>v.status==='APPROVED').length}</div><div class="stat-lbl">Approved</div></div>
    <div class="stat rejected"><div class="stat-num">${visitors.filter(v=>v.status==='REJECTED').length}</div><div class="stat-lbl">Rejected</div></div>
    <div class="stat scanned"><div class="stat-num">${visitors.filter(v=>v.scan_status==='SCANNED').length}</div><div class="stat-lbl">Entered</div></div>
  </div>

  <div class="table-wrap">
    <table>
      <thead><tr>
        <th>Photo</th><th>Name</th><th>Mobile</th><th>Meeting</th><th>Purpose</th>
        <th>Date / Time</th><th>Status</th><th>Scan</th><th>Entry Time</th>
      </tr></thead>
      <tbody>${rows || '<tr><td colspan="9" class="empty">No visitors yet.</td></tr>'}</tbody>
    </table>
  </div>
  <script>setTimeout(() => location.reload(), 30000);</script>
</body>
</html>`);
  } catch (err) {
    console.error('[/admin]', err.message);
    return res.status(500).send(`<pre style="color:red;background:#080810;padding:20px">Error: ${err.message}</pre>`);
  }
};
