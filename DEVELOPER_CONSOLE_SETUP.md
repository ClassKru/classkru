# ClassKru Developer Console

Developer Console อยู่ที่ `/developer/` และออกแบบให้แสดงข้อมูลแบบอ่านอย่างเดียวเท่านั้น

## Environment Variables บน Vercel

ตั้งค่าทั้ง Production, Preview และ Development ตามความเหมาะสม:

- `DEV_CONSOLE_PASSWORD` — รหัสผ่านที่ผู้ดูแลกำหนด ห้าม commit ลง Git
- `DEV_SESSION_SECRET` — ค่าสุ่มความยาวอย่างน้อย 32 ตัวอักษรสำหรับลงลายเซ็น session (ระบบจะไม่เปิดใช้งานหากสั้นกว่านี้)
- `SUPABASE_URL` — URL ของโครงการ Supabase (หากไม่ตั้ง ระบบใช้ URL ของ ClassKru ปัจจุบัน)
- `SUPABASE_SECRET_KEY` — Secret key รูปแบบ `sb_secret_...` ใช้เฉพาะ Vercel Serverless Functions (แนะนำ)
- `SUPABASE_SERVICE_ROLE_KEY` — รองรับ Legacy service-role key เพื่อความเข้ากันได้ย้อนหลัง

หลังเปลี่ยน Environment Variables ต้อง Redeploy เพื่อให้ deployment ใหม่ได้รับค่า

## Database Migration

รันไฟล์ `supabase/migrations/202608030001_developer_issue_console.sql` ใน Supabase SQL Editor หรือผ่าน Supabase CLI

Migration สร้างตารางเดียว:

- `issue_reports` — ข้อความจากผู้ใช้ที่เข้าสู่ระบบ พร้อมวันและเวลาที่ฐานข้อมูลบันทึกให้อัตโนมัติ
- RLS policy ให้ผู้ใช้ส่งและอ่านได้เฉพาะรายการของตัวเอง

Developer Console อ่านข้อมูลผ่าน Serverless Function ที่ใช้ service-role key ฝั่งเซิร์ฟเวอร์เท่านั้น

## Security Boundary

- รหัสผ่านไม่อยู่ใน HTML หรือ JavaScript ฝั่งเบราว์เซอร์
- Session cookie เป็น HttpOnly, SameSite=Strict และ Secure บน HTTPS
- API อนุญาตให้อ่านเฉพาะ `issue_reports` และเรียงข้อมูลจากใหม่ไปเก่า
- ไม่มี API สำหรับแก้ไข ลบ หรือรัน SQL
- หน้าและ API ส่ง `Cache-Control: no-store` และถูกตั้ง `noindex`
- การจำกัดจำนวนครั้งที่ลองรหัสผ่านใน Serverless Function เป็น best effort ควรเพิ่ม rate limiting ระดับ Vercel Firewall เมื่อเปิดให้ใช้งานระยะยาว
