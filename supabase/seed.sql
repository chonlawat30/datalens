-- ข้อมูลจำลอง: ยอดขายรายธุรกรรม 300 แถว (ปี 2025)
-- วิธีใช้: รัน schema.sql ก่อน แล้วรันไฟล์นี้ใน Supabase > SQL Editor
-- มีค่าว่างราว 6% ในคอลัมน์คะแนน และค่าผิดปกติ 3 แถว เพื่อสาธิตหน้า "คุณภาพข้อมูล"

with ds as (
  insert into datasets (name, columns, row_count)
  values (
    'ข้อมูลจำลอง: ยอดขายปี 2025',
    '[{"name":"วันที่","type":"date"},{"name":"ภูมิภาค","type":"category"},{"name":"หมวดสินค้า","type":"category"},
      {"name":"ช่องทางขาย","type":"category"},{"name":"จำนวน","type":"number"},{"name":"ราคาต่อหน่วย","type":"number"},
      {"name":"ยอดขาย","type":"number"},{"name":"คะแนนความพึงพอใจ","type":"number"}]'::jsonb,
    300
  )
  returning id
),
base as (
  select
    i,
    date '2025-01-01' + floor(random() * 365)::int                                                   as d,
    (array['กรุงเทพฯ','ภาคเหนือ','ภาคกลาง','ภาคอีสาน','ภาคใต้'])[1 + floor(random() * 5)::int]      as region,
    (array['อุปกรณ์ไอที','เครื่องเขียน','เฟอร์นิเจอร์','อาหารและเครื่องดื่ม'])[1 + floor(random() * 4)::int] as cat,
    (array['หน้าร้าน','เว็บไซต์','แอปพลิเคชัน'])[1 + floor(random() * 3)::int]                       as channel,
    1 + floor(random() * 20)::int                                                                    as qty,
    100 + floor(random() * 900)::int                                                                 as price,
    random()                                                                                         as r,
    random()                                                                                         as r2
  from generate_series(1, 300) as i
)
insert into dataset_rows (dataset_id, row_no, data)
select
  ds.id,
  b.i - 1,
  jsonb_build_object(
    'วันที่',            to_char(b.d, 'YYYY-MM-DD'),
    'ภูมิภาค',           b.region,
    'หมวดสินค้า',        b.cat,
    'ช่องทางขาย',        b.channel,
    'จำนวน',             b.qty,
    'ราคาต่อหน่วย',      b.price,
    'ยอดขาย',            case when b.i in (45, 130, 222) then b.qty * b.price * 12 else b.qty * b.price end,
    'คะแนนความพึงพอใจ',  case when b.r < 0.06 then null else round((3 + b.r2 * 2)::numeric, 1) end
  )
from base b cross join ds;

-- ตรวจผล
select name, row_count, (select count(*) from dataset_rows r where r.dataset_id = d.id) as rows_inserted
from datasets d where name like 'ข้อมูลจำลอง%' order by created_at desc limit 1;

-- ลบข้อมูลจำลองออก (ถ้าต้องการ):
-- delete from datasets where name like 'ข้อมูลจำลอง%';
