# DataLens
เว็บนำเสนอข้อมูล: อัปโหลด Excel/CSV → ทำความสะอาด → แดชบอร์ด (HTML + CSS + JS ล้วน ไม่ต้อง build)

## โครงสร้าง
- `index.html` โครงหน้า · `css/style.css` ธีมขาว-น้ำเงิน
- `js/data.js` ทำความสะอาด/วิเคราะห์ · `js/app.js` UI · `js/cloud.js` Supabase · `js/config.js` ค่าเชื่อมต่อ
- `supabase/schema.sql` สร้างตาราง

## ตั้งค่า Supabase
1. สร้างโปรเจกต์ → SQL Editor → รัน `supabase/schema.sql`
2. คัดลอก Project URL และ anon key ใส่ใน `js/config.js`

## Deploy
`git init && git add . && git commit -m init` → push ขึ้น GitHub → Vercel: Import repo (Framework: Other, ไม่ต้องตั้ง build) 

## สำรองกรณีออนไลน์ใช้ไม่ได้
ดาวน์โหลดโฟลเดอร์ แล้วรัน `python -m http.server 8000` เปิด http://localhost:8000
