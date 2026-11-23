// ===== ส่วนแสดงผล (UI) =====
const $ = id => document.getElementById(id), esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = v => v == null ? '' : v instanceof Date ? v.toISOString().slice(0, 10) : typeof v === 'number' ? (Number.isInteger(v) ? v.toLocaleString() : v.toLocaleString(undefined, { maximumFractionDigits: 2 })) : v;
const S = { name: '', wb: null, rows: [], cols: [], log: [], page: 0, charts: {} }, PAGE = 50;
const COLORS = ['#1d5fd1', '#0b2a5b', '#5b9bff', '#8fb8ff', '#3a4f7a', '#b9d3ff', '#2d7ff9', '#6c8ccf'];

function status(msg, err) { const s = $('status'); s.hidden = !msg; s.textContent = msg || ''; s.className = 'status' + (err ? ' err' : ''); }

// อัปโหลดไฟล์
async function readFile(f) {
  status('กำลังอ่านไฟล์ ' + f.name + ' …');
  try {
    if (f.size > 25 * 1024 * 1024) throw new Error('ไฟล์ใหญ่เกิน 25 MB กรุณาแบ่งไฟล์');
    S.wb = XLSX.read(await f.arrayBuffer(), { type: 'array', cellDates: true });
    S.name = f.name; pickSheet(S.wb.SheetNames[0]);
  } catch (e) { status('อ่านไฟล์ไม่สำเร็จ: ' + e.message + ' (ตรวจว่าเป็นไฟล์ .xlsx .xls หรือ .csv ที่ไม่เสียหาย)', true); }
}
function pickSheet(n) {
  const raw = XLSX.utils.sheet_to_json(S.wb.Sheets[n], { defval: null });
  if (!raw.length) return status('ชีต "' + n + '" ไม่มีข้อมูล ลองเลือกชีตอื่นหรือไฟล์อื่น', true);
  $('sheet').innerHTML = S.wb.SheetNames.map(s => `<option ${s === n ? 'selected' : ''}>${esc(s)}</option>`).join('');
  load(raw);
}
function load(raw) {
  const { rows, log } = Data.clean(raw); S.rows = rows; S.log = log; S.cols = Data.profile(rows);
  $('fname').textContent = S.name; $('upload').hidden = true; $('app').hidden = false; $('btnSave').disabled = false; status('');
  const by = t => S.cols.filter(c => c.type === t);
  const opt = (arr, none) => (none ? '<option value="">' + none + '</option>' : '') + arr.map(c => `<option>${esc(c.name)}</option>`).join('');
  $('gCat').innerHTML = opt(by('category').concat(by('text').filter(c => c.unique < 60)));
  $('gNum').innerHTML = opt(by('number')); $('gDate').innerHTML = opt(by('date'), '— ไม่ใช้ —');
  $('fcol').innerHTML = opt(by('category'), 'กรองตาม…'); $('fval').innerHTML = '<option value="">ทั้งหมด</option>'; $('q').value = '';
  S.page = 0; renderAll();
}

// ตัวกรอง
function view() {
  const q = $('q').value.trim().toLowerCase(), c = $('fcol').value, v = $('fval').value;
  return S.rows.filter(r => (!c || !v || String(r[c]) === v) && (!q || Object.values(r).some(x => fmt(x).toString().toLowerCase().includes(q))));
}
function renderAll() { const v = view(); renderOverview(v); renderQuality(); renderExplore(v); renderTable(v); }

function chart(id, cfg) {
  S.charts[id]?.destroy();
  cfg.options = Object.assign({ responsive: true, maintainAspectRatio: false, animation: false }, cfg.options);
  S.charts[id] = new Chart($(id), cfg);
}
function renderOverview(v) {
  const all = S.cols, miss = all.reduce((a, c) => a + c.missing, 0), tot = S.rows.length * all.length || 1;
  $('kpis').innerHTML = [[v.length.toLocaleString(), 'แถวที่แสดง (จาก ' + S.rows.length.toLocaleString() + ')'], [all.length, 'คอลัมน์'], [(100 - 100 * miss / tot).toFixed(1) + '%', 'ความครบถ้วนของข้อมูล'], [all.reduce((a, c) => a + (c.outliers || 0), 0), 'ค่าผิดปกติที่พบ']]
    .map(k => `<div class="kpi"><b>${k[0]}</b><span>${k[1]}</span></div>`).join('');
  const cat = $('gCat').value, num = $('gNum').value, agg = num ? $('gAgg').value : 'count', date = $('gDate').value, lab = { sum: 'ผลรวม', avg: 'ค่าเฉลี่ย', count: 'จำนวนแถว' }[agg];
  const nm = agg === 'count' ? '' : num + ' ';
  if (cat) { const g = Data.group(v, cat, num, agg).slice(0, 12);
    $('t1').textContent = `${lab}${agg === 'count' ? '' : ' ' + num} แยกตาม ${cat}`; chart('c1', { type: 'bar', data: { labels: g.map(x => x[0]), datasets: [{ label: lab, data: g.map(x => x[1]), backgroundColor: '#1d5fd1' }] }, options: { plugins: { legend: { display: false } } } });
    $('t2').textContent = `สัดส่วนของ ${cat}`; chart('c2', { type: 'doughnut', data: { labels: g.map(x => x[0]), datasets: [{ data: g.map(x => x[1]), backgroundColor: COLORS }] }, options: { plugins: { legend: { position: 'right' } } } }); }
  else { $('t1').textContent = $('t2').textContent = 'ไม่พบคอลัมน์หมวดหมู่สำหรับสร้างกราฟนี้'; ['c1', 'c2'].forEach(i => S.charts[i]?.destroy()); }
  if (date) { const m = new Map(); v.forEach(r => { const d = r[date]; if (!(d instanceof Date)) return; const k = d.toISOString().slice(0, 7), o = m.get(k) || { s: 0, n: 0 }; o.n++; if (Data.isNum(r[num])) o.s += r[num]; m.set(k, o); });
    const ks = [...m.keys()].sort(); $('t3').textContent = `แนวโน้ม${lab}รายเดือน`;
    chart('c3', { type: 'line', data: { labels: ks, datasets: [{ label: lab, data: ks.map(k => { const o = m.get(k); return agg === 'count' ? o.n : agg === 'avg' ? o.s / o.n : o.s; }), borderColor: '#1d5fd1', backgroundColor: '#e8f0fd', fill: true, tension: .25 }] }, options: { plugins: { legend: { display: false } } } }); }
  else { $('t3').textContent = 'ไม่พบคอลัมน์วันที่สำหรับกราฟแนวโน้ม'; S.charts.c3?.destroy(); }
  if (num) { const xs = v.map(r => r[num]).filter(Data.isNum); const mn = Math.min(...xs), mx = Math.max(...xs), b = 10, w = (mx - mn) / b || 1, h = Array(b).fill(0);
    xs.forEach(x => h[Math.min(b - 1, Math.floor((x - mn) / w))]++); $('t4').textContent = `การกระจายของ ${num}`;
    chart('c4', { type: 'bar', data: { labels: h.map((_, i) => fmt(+(mn + i * w).toFixed(1))), datasets: [{ label: 'จำนวน', data: h, backgroundColor: '#5b9bff' }] }, options: { plugins: { legend: { display: false } }, scales: { x: { title: { display: true, text: num } } } } }); }
  else { $('t4').textContent = 'ไม่พบคอลัมน์ตัวเลข'; S.charts.c4?.destroy(); }
  // Insight สั้น ๆ
  const ins = [], p = S.cols.find(c => c.name === num);
  if (cat) { const g = Data.group(v, cat, num, agg); if (g.length) ins.push(`<b>${esc(g[0][0])}</b> มี${lab}${agg === 'count' ? '' : esc(' ' + num)} สูงสุดในกลุ่ม ${esc(cat)} (${fmt(+g[0][1].toFixed(2))})`); }
  if (p?.outliers) ins.push(`คอลัมน์ ${esc(num)} มีค่าผิดปกติ ${p.outliers} ค่า ควรตรวจสอบก่อนนำไปตัดสินใจ`);
  const worst = [...S.cols].sort((a, b) => a.complete - b.complete)[0]; if (worst && worst.missing) ins.push(`คอลัมน์ ${esc(worst.name)} ขาดข้อมูลมากที่สุด ${worst.missing} ค่า (${(100 - worst.complete).toFixed(1)}%)`);
  $('insights').innerHTML = '<h2>สรุปประเด็นสำคัญ</h2>' + (ins.length ? '<ul>' + ins.map(i => `<li>${i}</li>`).join('') + '</ul>' : '<p>ยังไม่พบประเด็นเด่น</p>');
}
function renderQuality() {
  $('log').innerHTML = S.log.map(l => `<li>${esc(l)}</li>`).join('');
  const tn = { number: 'ตัวเลข', date: 'วันที่', category: 'หมวดหมู่', text: 'ข้อความ' };
  $('dict').innerHTML = '<tr><th>คอลัมน์</th><th>ชนิด</th><th>ความครบถ้วน</th><th>ค่าว่าง</th><th>ค่าไม่ซ้ำ</th><th>ค่าผิดปกติ</th></tr>' + S.cols.map(c =>
    `<tr><td>${esc(c.name)}</td><td><span class="pill">${tn[c.type]}</span></td><td><div class="meter"><i style="width:${c.complete}%"></i></div>${c.complete.toFixed(1)}%</td><td class="n">${c.missing}</td><td class="n">${c.unique}</td><td>${c.outliers ? `<span class="pill w">${c.outliers}</span>` : '–'}</td></tr>`).join('');
}
function renderExplore(v) {
  const P = Data.profile(v).filter(c => c.type === 'number');
  $('stats').innerHTML = P.length ? '<tr><th>คอลัมน์</th><th>เฉลี่ย</th><th>มัธยฐาน</th><th>ส่วนเบี่ยงเบนมาตรฐาน</th><th>ต่ำสุด</th><th>สูงสุด</th><th>ผลรวม</th></tr>' + P.map(c => `<tr><td>${esc(c.name)}</td>${[c.mean, c.median, c.sd, c.min, c.max, c.sum].map(x => `<td class="n">${fmt(+x?.toFixed(2))}</td>`).join('')}</tr>`).join('') : '<tr><td>ไม่พบคอลัมน์ตัวเลข</td></tr>';
  const names = P.map(c => c.name), M = Data.corr(v, names);
  $('corr').innerHTML = names.length > 1 ? '<table><tr><th></th>' + names.map(n => `<th>${esc(n)}</th>`).join('') + '</tr>' + names.map((a, i) => `<tr><th>${esc(a)}</th>` + names.map((b, j) => { const r = M[i * names.length + j], a = r == null ? 0 : Math.abs(r);
    return `<td class="n" style="background:rgba(29,95,209,${a * .6});color:${a > .55 ? '#fff' : 'inherit'}">${r == null ? '–' : r.toFixed(2)}</td>`; }).join('') + '</tr>').join('') + '</table><p class="hint">ใกล้ +1 = เพิ่มไปด้วยกัน, ใกล้ −1 = สวนทางกัน, ใกล้ 0 = ไม่สัมพันธ์</p>' : '<p>ต้องมีคอลัมน์ตัวเลขอย่างน้อย 2 คอลัมน์</p>';
}
function renderTable(v) {
  const pages = Math.max(1, Math.ceil(v.length / PAGE)); S.page = Math.min(S.page, pages - 1);
  $('count').textContent = v.length ? `พบ ${v.length.toLocaleString()} แถว` : 'ไม่พบข้อมูลตามตัวกรอง ลองล้างตัวกรองหรือเปลี่ยนคำค้นหา';
  $('data').innerHTML = '<tr>' + S.cols.map(c => `<th>${esc(c.name)}</th>`).join('') + '</tr>' + v.slice(S.page * PAGE, (S.page + 1) * PAGE).map(r => '<tr>' + S.cols.map(c => `<td class="${c.type === 'number' ? 'n' : ''}">${esc(fmt(r[c.name]))}</td>`).join('') + '</tr>').join('');
  $('pg').textContent = `หน้า ${S.page + 1} / ${pages}`; $('prev').disabled = S.page === 0; $('next').disabled = S.page >= pages - 1;
}

// เหตุการณ์
document.querySelectorAll('.tab').forEach(b => b.onclick = () => { document.querySelectorAll('.tab').forEach(x => x.classList.toggle('on', x === b)); document.querySelectorAll('.pane').forEach(p => p.classList.toggle('on', p.id === 'p-' + b.dataset.t)); if (b.dataset.t === 'overview' && S.rows.length) renderOverview(view()); });
$('file').onchange = e => e.target.files[0] && readFile(e.target.files[0]);
$('btnSample').onclick = () => { S.name = 'ข้อมูลตัวอย่าง (ยอดขาย)'; S.wb = null; $('sheet').innerHTML = ''; load(Data.sample()); };
$('sheet').onchange = e => pickSheet(e.target.value);
const dz = $('upload'); ['dragover', 'dragenter'].forEach(t => dz.addEventListener(t, e => { e.preventDefault(); dz.classList.add('over'); }));
['dragleave', 'drop'].forEach(t => dz.addEventListener(t, e => { e.preventDefault(); dz.classList.remove('over'); }));
dz.addEventListener('drop', e => e.dataTransfer.files[0] && readFile(e.dataTransfer.files[0]));
['gCat', 'gNum', 'gAgg', 'gDate'].forEach(i => $(i).onchange = () => renderOverview(view()));
$('q').oninput = () => { S.page = 0; renderAll(); };
$('fcol').onchange = () => { const c = $('fcol').value; $('fval').innerHTML = '<option value="">ทั้งหมด</option>' + (c ? [...new Set(S.rows.map(r => r[c]))].filter(x => x != null).sort().map(x => `<option>${esc(x)}</option>`).join('') : ''); S.page = 0; renderAll(); };
$('fval').onchange = () => { S.page = 0; renderAll(); };
$('btnReset').onclick = () => { $('q').value = ''; $('fcol').value = ''; $('fval').innerHTML = '<option value="">ทั้งหมด</option>'; S.page = 0; renderAll(); };
$('prev').onclick = () => { S.page--; renderTable(view()); }; $('next').onclick = () => { S.page++; renderTable(view()); };
$('btnCsv').onclick = () => { const ws = XLSX.utils.json_to_sheet(view()), a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\ufeff' + XLSX.utils.sheet_to_csv(ws)], { type: 'text/csv' })); a.download = 'datalens-export.csv'; a.click(); };
$('btnSave').onclick = async () => {
  if (!Cloud.ok()) return status('ยังไม่ได้ตั้งค่า Supabase: ใส่ URL และ anon key ในไฟล์ js/config.js', true);
  status('กำลังบันทึกขึ้น Cloud …'); try { await Cloud.save(S.name, S.cols.map(({ name, type }) => ({ name, type })), S.rows); status('บันทึกสำเร็จ ' + S.rows.length.toLocaleString() + ' แถว'); } catch (e) { status('บันทึกไม่สำเร็จ: ' + e.message, true); }
};
$('btnHistory').onclick = async () => {
  const box = $('hist'); $('dlg').showModal();
  if (!Cloud.ok()) return box.textContent = 'ยังไม่ได้ตั้งค่า Supabase ใน js/config.js';
  box.textContent = 'กำลังโหลด …';
  try { const l = await Cloud.list(); box.innerHTML = l.length ? l.map(d => `<div class="h"><span>${esc(d.name)}<br><small>${d.row_count} แถว · ${new Date(d.created_at).toLocaleString('th-TH')}</small></span><button class="ghost" data-id="${d.id}" data-n="${esc(d.name)}">เปิด</button></div>`).join('') : 'ยังไม่มีไฟล์ที่บันทึกไว้';
    box.querySelectorAll('button').forEach(b => b.onclick = async () => { $('dlg').close(); status('กำลังโหลดข้อมูล …'); try { S.name = b.dataset.n; load(await Cloud.load(b.dataset.id)); } catch (e) { status('โหลดไม่สำเร็จ: ' + e.message, true); } }); }
  catch (e) { box.textContent = 'โหลดรายการไม่สำเร็จ: ' + e.message; }
};
