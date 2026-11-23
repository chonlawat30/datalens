// ชั้นเชื่อมต่อ Supabase: ทุกข้อมูลที่แดชบอร์ดแสดงมาจากที่นี่
const Cloud = {
  sb: null,
  ok() {
    const c = window.APP_CONFIG || {};
    if (!c.SUPABASE_URL || !c.SUPABASE_ANON_KEY) return false;
    this.sb = this.sb || supabase.createClient(c.SUPABASE_URL, c.SUPABASE_ANON_KEY);
    return true;
  },
  async save(name, cols, rows, log) {
    const { data, error } = await this.sb.from('datasets')
      .insert({ name, columns: cols, row_count: rows.length, clean_log: log }).select('id').single();
    if (error) throw error;
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500).map((r, j) => ({ dataset_id: data.id, row_no: i + j, data: r }));
      const { error: e2 } = await this.sb.from('dataset_rows').insert(chunk);
      if (e2) { await this.sb.from('datasets').delete().eq('id', data.id); throw e2; }
    }
    return data.id;
  },
  async list() {
    const { data, error } = await this.sb.from('datasets').select('id,name,row_count,clean_log,created_at').order('created_at', { ascending: false }).limit(50);
    if (error) throw error; return data;
  },
  async load(id) {
    let all = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await this.sb.from('dataset_rows').select('data').eq('dataset_id', id).order('row_no').range(from, from + 999);
      if (error) throw error; all = all.concat(data.map(d => d.data));
      if (data.length < 1000) return all;
    }
  }
};
