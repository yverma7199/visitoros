// api/admin.js
const { getSheetData, setCors, VISITORS_SHEET } = require('./_sheets');

module.exports = async (req, res) => {
  setCors(res);
  try {
    const visitors = await getSheetData(VISITORS_SHEET);
    visitors.sort((a, b) => new Date(b.visit_date + ' ' + b.visit_time) - new Date(a.visit_date + ' ' + a.visit_time));

    const total    = visitors.length;
    const pending  = visitors.filter(v => v.status === 'PENDING').length;
    const approved = visitors.filter(v => v.status === 'APPROVED').length;
    const rejected = visitors.filter(v => v.status === 'REJECTED').length;
    const scanned  = visitors.filter(v => v.scan_status === 'SCANNED').length;

    const rows = visitors.map(v => {
      const photoHtml = v.photo_url
        ? `<img src="${v.photo_url}" class="visitor-photo" alt="">`
        : `<div class="visitor-photo-placeholder">👤</div>`;
      const statusClass = { APPROVED:'approved', REJECTED:'rejected', PENDING:'pending' }[v.status] || 'pending';
      const scanClass   = v.scan_status === 'SCANNED' ? 'scanned' : 'not-scanned';
      const formatTime  = iso => { try { return new Date(iso).toLocaleString('en-IN',{dateStyle:'short',timeStyle:'short'}); } catch{return iso;} };
      return `<tr data-status="${v.status||''}">
        <td class="photo-cell">${photoHtml}</td>
        <td><div class="vname">${v.visitor_name||'—'}</div><div class="vsub">${v.visitor_mobile||''}</div></td>
        <td><div class="vname">${v.person_to_meet||'—'}</div><div class="vsub">${v.purpose||''}</div></td>
        <td><div class="vname">${v.visit_date||'—'}</div><div class="vsub">${v.visit_time||''}</div></td>
        <td><span class="badge badge-${statusClass}">${v.status||'—'}</span></td>
        <td><span class="badge badge-${scanClass}">${v.scan_status==='SCANNED'?'Entered':'Pending'}</span></td>
        <td class="tcell">${v.scan_time ? formatTime(v.scan_time) : '—'}</td>
        <td>${v.visitor_id?`<a href="/pass/${v.visitor_id}" class="alink" target="_blank">Pass ↗</a>`:''}</td>
      </tr>`;
    }).join('');

    res.setHeader('Content-Type','text/html; charset=utf-8');
    res.status(200).send(`<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Admin — VisitorOS</title>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700&family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
:root{--bg:#f7f4ef;--s:#fff;--s2:#faf8f5;--b:#e4ddd4;--t:#1a1510;--tm:#6b6055;--td:#a89e93;--ac:#2c4a3e;--aw:#c4622d;--ok:#2c7a4b;--err:#c0392b;--warn:#b8860b;--sh:0 2px 16px rgba(26,21,16,.07);--sh2:0 6px 32px rgba(26,21,16,.1);}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
body{font-family:'DM Sans',sans-serif;background:var(--bg);color:var(--t);min-height:100vh;}
.topbar{background:var(--s);border-bottom:1px solid var(--b);padding:0 24px;height:58px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100;box-shadow:0 1px 8px rgba(26,21,16,.05);}
.tl{display:flex;align-items:center;gap:10px;}
.li{width:30px;height:30px;background:var(--ac);border-radius:7px;display:flex;align-items:center;justify-content:center;color:#fff;flex-shrink:0;}
.lt{font-family:'DM Mono',monospace;font-size:13px;font-weight:500;}
.pt{font-size:13px;color:var(--tm);border-left:1px solid var(--b);padding-left:10px;margin-left:2px;}
.tr2{display:flex;align-items:center;gap:8px;}
.bsm{padding:6px 13px;border-radius:7px;font-family:'DM Sans',sans-serif;font-size:12px;font-weight:500;cursor:pointer;transition:all .15s;text-decoration:none;display:inline-flex;align-items:center;gap:5px;border:1.5px solid var(--b);background:var(--s);color:var(--tm);}
.bsm:hover{border-color:var(--ac);color:var(--ac);}
.bsm.pr{background:var(--ac);color:#fff;border-color:var(--ac);}
.bsm.pr:hover{background:#1e3329;}
.ref{font-size:11px;color:var(--td);font-family:'DM Mono',monospace;}
.main{padding:24px;max-width:1400px;margin:0 auto;animation:fi .4s ease;}
@keyframes fi{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
.sg{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:20px;}
@media(max-width:900px){.sg{grid-template-columns:repeat(3,1fr);}}
@media(max-width:500px){.sg{grid-template-columns:repeat(2,1fr);}}
.sc{background:var(--s);border:1px solid var(--b);border-radius:12px;padding:16px 18px;box-shadow:var(--sh);transition:box-shadow .2s;}
.sc:hover{box-shadow:var(--sh2);}
.sn{font-family:'Playfair Display',serif;font-size:34px;font-weight:700;line-height:1;}
.sl{font-size:10px;color:var(--td);font-family:'DM Mono',monospace;text-transform:uppercase;letter-spacing:1.5px;margin-top:5px;}
.sc.tot .sn{color:var(--t);}
.sc.pen .sn{color:var(--warn);}
.sc.app .sn{color:var(--ok);}
.sc.rej .sn{color:var(--err);}
.sc.sc2 .sn{color:var(--ac);}
.ts{background:var(--s);border:1px solid var(--b);border-radius:12px;box-shadow:var(--sh);overflow:hidden;}
.th{padding:16px 20px;border-bottom:1px solid var(--b);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;}
.th h2{font-family:'Playfair Display',serif;font-size:18px;}
.vc{font-size:11px;color:var(--td);font-family:'DM Mono',monospace;}
.si{background:var(--s2);border:1.5px solid var(--b);border-radius:7px;padding:6px 11px;font-family:'DM Sans',sans-serif;font-size:12px;color:var(--t);outline:none;width:200px;transition:border-color .2s;}
.si:focus{border-color:var(--ac);}
.ftabs{display:flex;gap:5px;flex-wrap:wrap;}
.ft{padding:4px 11px;border-radius:5px;font-size:11px;font-family:'DM Mono',monospace;cursor:pointer;border:1.5px solid var(--b);background:transparent;color:var(--tm);transition:all .15s;}
.ft.ac2{background:var(--ac);color:#fff;border-color:var(--ac);}
.ft:hover:not(.ac2){border-color:var(--ac);color:var(--ac);}
.tw{overflow-x:auto;}
table{width:100%;border-collapse:collapse;min-width:700px;}
thead th{background:var(--s2);padding:9px 14px;text-align:left;font-size:10px;font-family:'DM Mono',monospace;text-transform:uppercase;letter-spacing:1.5px;color:var(--td);border-bottom:1px solid var(--b);white-space:nowrap;}
tbody td{padding:11px 14px;border-bottom:1px solid #f5f0eb;vertical-align:middle;font-size:13px;}
tbody tr:last-child td{border-bottom:none;}
tbody tr:hover td{background:var(--s2);}
.photo-cell{width:48px;}
.visitor-photo{width:36px;height:36px;border-radius:50%;object-fit:cover;border:2px solid var(--b);}
.visitor-photo-placeholder{width:36px;height:36px;border-radius:50%;background:var(--s2);border:1.5px solid var(--b);display:flex;align-items:center;justify-content:center;font-size:15px;}
.vname{font-weight:600;font-size:13px;color:var(--t);}
.vsub{font-size:11px;color:var(--td);font-family:'DM Mono',monospace;margin-top:2px;}
.badge{padding:3px 9px;border-radius:20px;font-size:10px;font-weight:600;font-family:'DM Mono',monospace;letter-spacing:.5px;white-space:nowrap;display:inline-block;}
.badge-approved{background:rgba(44,122,75,.1);color:var(--ok);}
.badge-rejected{background:rgba(192,57,43,.1);color:var(--err);}
.badge-pending{background:rgba(184,134,11,.1);color:var(--warn);}
.badge-scanned{background:rgba(44,74,62,.1);color:var(--ac);}
.badge-not-scanned{background:#f5f0eb;color:var(--td);}
.tcell{font-size:11px;color:var(--tm);font-family:'DM Mono',monospace;white-space:nowrap;}
.alink{color:var(--ac);font-size:11px;text-decoration:none;font-family:'DM Mono',monospace;padding:2px 7px;border:1px solid rgba(44,74,62,.2);border-radius:4px;transition:all .15s;white-space:nowrap;}
.alink:hover{background:var(--ac);color:#fff;border-color:var(--ac);}
.empty-state{text-align:center;padding:50px;color:var(--td);font-size:14px;}
.empty-state div:first-child{font-size:32px;margin-bottom:8px;}
</style></head>
<body>
<header class="topbar">
  <div class="tl">
    <div class="li"><svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
    <span class="lt">VisitorOS</span>
    <span class="pt">Admin Panel</span>
  </div>
  <div class="tr2">
    <span class="ref">Updated ${new Date().toLocaleTimeString('en-IN',{timeStyle:'short'})}</span>
    <button class="bsm" onclick="location.reload()">↺ Refresh</button>
    <a href="/staff.html" class="bsm">← Portal</a>
    <a href="/" class="bsm pr">+ Register</a>
  </div>
</header>
<div class="main">
  <div class="sg">
    <div class="sc tot"><div class="sn">${total}</div><div class="sl">Total</div></div>
    <div class="sc pen"><div class="sn">${pending}</div><div class="sl">Pending</div></div>
    <div class="sc app"><div class="sn">${approved}</div><div class="sl">Approved</div></div>
    <div class="sc rej"><div class="sn">${rejected}</div><div class="sl">Rejected</div></div>
    <div class="sc sc2"><div class="sn">${scanned}</div><div class="sl">Entered</div></div>
  </div>
  <div class="ts">
    <div class="th">
      <div><h2>Visitor Log</h2><div class="vc">${total} record${total!==1?'s':''}</div></div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
        <div class="ftabs">
          <button class="ft ac2" onclick="setFilter('all',this)">All</button>
          <button class="ft" onclick="setFilter('PENDING',this)">Pending</button>
          <button class="ft" onclick="setFilter('APPROVED',this)">Approved</button>
          <button class="ft" onclick="setFilter('REJECTED',this)">Rejected</button>
        </div>
        <input class="si" type="text" placeholder="Search…" oninput="search(this.value)">
      </div>
    </div>
    <div class="tw">
      <table>
        <thead><tr><th></th><th>Visitor</th><th>Meeting</th><th>Date/Time</th><th>Status</th><th>Entry</th><th>Scanned</th><th></th></tr></thead>
        <tbody id="tb">${rows||`<tr><td colspan="8" class="empty-state"><div>📋</div><div>No visitors yet</div></td></tr>`}</tbody>
      </table>
    </div>
  </div>
</div>
<script>
const allRows=Array.from(document.querySelectorAll('#tb tr'));
let cf='all',cs='';
function setFilter(f,btn){cf=f;document.querySelectorAll('.ft').forEach(t=>t.classList.remove('ac2'));btn.classList.add('ac2');apply();}
function search(v){cs=v.toLowerCase();apply();}
function apply(){
  let vis=0;
  allRows.forEach(r=>{
    if(r.querySelector('.empty-state'))return;
    const txt=r.textContent.toLowerCase();
    const st=r.dataset.status||'';
    const sm=cf==='all'||st===cf;
    const qm=!cs||txt.includes(cs);
    r.style.display=(sm&&qm)?'':'none';
    if(sm&&qm)vis++;
  });
  let nr=document.getElementById('nr');
  if(vis===0&&allRows.length>0){
    if(!nr){nr=document.createElement('tr');nr.id='nr';nr.innerHTML='<td colspan="8" class="empty-state"><div>🔍</div><div>No matching visitors</div></td>';document.getElementById('tb').appendChild(nr);}
    nr.style.display='';
  }else if(nr){nr.style.display='none';}
}
setTimeout(()=>location.reload(),30000);
</script>
</body></html>`);
  } catch(err) {
    console.error('[/admin]', err.message);
    res.status(500).send(`<pre style="color:red;padding:20px">Error: ${err.message}</pre>`);
  }
};
