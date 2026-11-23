// ===== การอ่านไฟล์ ทำความสะอาด และวิเคราะห์ข้อมูล (ไม่แตะ DOM) =====
const Data = {
  isNum: v => typeof v === 'number' && isFinite(v),
  toNum(v) {
    if (this.isNum(v)) return v;
    if (typeof v !== 'string') return null;
    const s = v.replace(/[,฿$%\s]/g, '');
    return s !== '' && isFinite(s) ? +s : null;
  },
  toDate(v) {
    if (v instanceof Date) return isNaN(v) ? null : v;
    if (typeof v !== 'string' || !/^\d{4}-\d{1,2}-\d{1,2}|^\d{1,2}\/\d{1,2}\/\d{4}/.test(v.trim())) return null;
    const d = new Date(v); return isNaN(d) ? null : d;
  },
  // ทำความสะอาด: ตัดช่องว่าง, ค่าว่าง→null, ลบแถวว่าง/แถวซ้ำ, แปลงข้อความตัวเลข/วันที่
  clean(raw) {
    const log = [], n0 = raw.length;
    let rows = raw.map(r => { const o = {}; for (const k in r) { let v = r[k]; if (typeof v === 'string') { v = v.trim().replace(/\s+/g, ' '); if (v === '' || /^(n\/a|na|null|-|–)$/i.test(v)) v = null; } o[String(k).trim()] = v; } return o; });
    log.push(`อ่านข้อมูลได้ ${n0.toLocaleString()} แถว และตัดช่องว่างส่วนเกินในข้อความทุกช่อง`);
    const a = rows.length; rows = rows.filter(r => Object.values(r).some(v => v !== null && v !== undefined));
    if (a - rows.length) log.push(`ลบแถวว่าง ${a - rows.length} แถว`);
    const seen = new Set(), b = rows.length;
    rows = rows.filter(r => { const k = JSON.stringify(r); if (seen.has(k)) return false; seen.add(k); return true; });
    log.push(b - rows.length ? `ลบแถวซ้ำ ${b - rows.length} แถว` : 'ไม่พบแถวซ้ำ');
    const names = rows.length ? Object.keys(rows[0]) : [];
    const allKeys = [...new Set(rows.flatMap(r => Object.keys(r)))];
    for (const c of allKeys) {
      const vals = rows.map(r => r[c]).filter(v => v != null);
      if (!vals.length) continue;
      const nums = vals.filter(v => this.toNum(v) !== null).length;
      const dates = vals.filter(v => this.toDate(v)).length;
      if (vals.some(v => typeof v === 'string') && nums / vals.length >= .9) { rows.forEach(r => { if (r[c] != null) r[c] = this.toNum(r[c]); }); log.push(`แปลงคอลัมน์ "${c}" จากข้อความเป็นตัวเลข`); }
      else if (dates / vals.length >= .9 && !vals.every(v => v instanceof Date)) { rows.forEach(r => { if (r[c] != null) r[c] = this.toDate(r[c]); }); log.push(`แปลงคอลัมน์ "${c}" เป็นวันที่`); }
    }
    rows.forEach(r => allKeys.forEach(k => { if (!(k in r)) r[k] = null; }));
    return { rows, log };
  },
  q(sorted, p) { const i = (sorted.length - 1) * p, lo = Math.floor(i); return sorted[lo] + (sorted[Math.ceil(i)] - sorted[lo]) * (i - lo); },
  // วิเคราะห์โปรไฟล์ของแต่ละคอลัมน์: ชนิด, ค่าว่าง, ค่าซ้ำ, สถิติ, ค่าผิดปกติ (IQR)
  profile(rows) {
    const keys = rows.length ? Object.keys(rows[0]) : [];
    return keys.map(name => {
      const all = rows.map(r => r[name]), vals = all.filter(v => v != null);
      const uniq = new Set(vals.map(v => v instanceof Date ? +v : v)).size;
      let type = 'text';
      if (vals.length && vals.every(v => this.isNum(v))) type = 'number';
      else if (vals.length && vals.every(v => v instanceof Date)) type = 'date';
      else if (vals.length && uniq <= Math.max(20, vals.length * .05)) type = 'category';
      const p = { name, type, total: all.length, missing: all.length - vals.length, unique: uniq };
      p.complete = all.length ? 100 * vals.length / all.length : 0;
      if (type === 'number' && vals.length) {
        const s = [...vals].sort((a, b) => a - b), sum = vals.reduce((a, b) => a + b, 0), m = sum / vals.length;
        const sd = Math.sqrt(vals.reduce((a, b) => a + (b - m) ** 2, 0) / vals.length);
        const q1 = this.q(s, .25), q3 = this.q(s, .75), iqr = q3 - q1;
        Object.assign(p, { sum, mean: m, sd, min: s[0], max: s[s.length - 1], median: this.q(s, .5), q1, q3, lo: q1 - 1.5 * iqr, hi: q3 + 1.5 * iqr });
        p.outliers = vals.filter(v => v < p.lo || v > p.hi).length;
      }
      return p;
    });
  },
  corr(rows, cols) {
    const out = [];
    for (const a of cols) for (const b of cols) {
      const pr = rows.filter(r => this.isNum(r[a]) && this.isNum(r[b]));
      if (pr.length < 3) { out.push(null); continue; }
      const ma = pr.reduce((s, r) => s + r[a], 0) / pr.length, mb = pr.reduce((s, r) => s + r[b], 0) / pr.length;
      let sab = 0, sa = 0, sb = 0; pr.forEach(r => { sab += (r[a] - ma) * (r[b] - mb); sa += (r[a] - ma) ** 2; sb += (r[b] - mb) ** 2; });
      out.push(sa && sb ? sab / Math.sqrt(sa * sb) : null);
    }
    return out;
  },
  group(rows, cat, num, agg) {
    const m = new Map();
    rows.forEach(r => { const k = r[cat] == null ? '(ไม่ระบุ)' : String(r[cat]); const o = m.get(k) || { s: 0, n: 0 }; o.n++; if (this.isNum(r[num])) o.s += r[num]; m.set(k, o); });
    return [...m].map(([k, o]) => [k, agg === 'count' ? o.n : agg === 'avg' ? o.s / o.n : o.s]).sort((a, b) => b[1] - a[1]);
  },
  sample() {
    const regions = ['กรุงเทพฯ', 'ภาคเหนือ', 'ภาคกลาง', 'ภาคอีสาน', 'ภาคใต้'], cats = ['อุปกรณ์ไอที', 'เครื่องเขียน', 'เฟอร์นิเจอร์', 'อาหารและเครื่องดื่ม'];
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647, out = [];
    for (let i = 0; i < 240; i++) { const d = new Date(2025, Math.floor(i / 20), 1 + Math.floor(rnd() * 27)), q = 1 + Math.floor(rnd() * 20), p = 100 + Math.floor(rnd() * 900);
      out.push({ วันที่: d, ภูมิภาค: regions[Math.floor(rnd() * 5)], หมวดสินค้า: cats[Math.floor(rnd() * 4)], จำนวน: q, ราคาต่อหน่วย: p, ยอดขาย: i === 33 ? 250000 : q * p, คะแนนความพึงพอใจ: rnd() < .06 ? null : +(3 + rnd() * 2).toFixed(1) }); }
    return out;
  }
};
