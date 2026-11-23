create table datasets (
  id uuid primary key default gen_random_uuid(),
  name text not null, columns jsonb, row_count int, clean_log jsonb,
  created_at timestamptz default now()
);
create table dataset_rows (
  id bigserial primary key,
  dataset_id uuid references datasets(id) on delete cascade,
  row_no int, data jsonb
);
create index on dataset_rows(dataset_id, row_no);
alter table datasets enable row level security;
alter table dataset_rows enable row level security;
-- เดโมแบบเปิดสาธารณะ (ไม่มีล็อกอิน) ถ้าใช้งานจริงควรจำกัดสิทธิ์เพิ่ม
create policy "public read"  on datasets for select using (true);
create policy "public write" on datasets for insert with check (true);
create policy "public read"  on dataset_rows for select using (true);
create policy "public write" on dataset_rows for insert with check (true);

-- ถ้าเคยสร้างตาราง datasets ไปแล้วจากเวอร์ชันก่อน ให้รันบรรทัดนี้เพิ่ม
alter table datasets add column if not exists clean_log jsonb;
-- ให้ลบข้อมูลที่อัปโหลดไม่สมบูรณ์ได้ (ใช้ตอนอัปโหลดล้มเหลวกลางทาง)
do $$ begin
  if not exists (select 1 from pg_policies where tablename='datasets' and policyname='public delete') then
    create policy "public delete" on datasets for delete using (true);
  end if;
end $$;
