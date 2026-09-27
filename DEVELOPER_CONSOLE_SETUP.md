# ClassKru Developer Console

Developer Console อยู่ที่ `/developer/` โดยข้อมูลความคิดเห็นจากผู้ใช้, Billing และ Database Viewer เป็นแบบอ่านอย่างเดียว ส่วนแท็บ Biggy และ PetchPetch สามารถบันทึกไอเดีย อัปเดตสถานะ และคอมเมนต์ร่วมกันได้

แท็บ `สมาชิกและการชำระเงิน` อ่านสถานะบัญชีและวันหมดอายุจาก `teacher_profiles` รวมถึงนับรายการ `payment_orders` ที่มีสถานะ `paid` หลังติดตั้ง migration `202609170001_membership_billing_foundation.sql`

แท็บ `ภาพรวมธุรกิจ` และ `การใช้งาน` อ่านข้อมูลจาก Supabase ณ เวลาที่เปิดหน้าหรือกดรีเฟรช โดยนับบัญชีที่บันทึก/แก้ไขข้อมูลห้องเรียน ตารางสอน นักเรียน เช็กชื่อ หรือคะแนนในวันนี้ (เวลาไทย), 7 วัน และ 30 วันล่าสุด การเปิดเว็บอย่างเดียวไม่ถือเป็นการใช้งาน จำนวนห้องเรียน/ตารางสอนคือรายการที่ยังไม่ถูกลบ ส่วนตัวเลขเช็กชื่อและคะแนนรายบัญชีอิงรายการที่แก้ไขใน 30 วัน ไม่ใช่ event log จึงไม่ใช่จำนวนครั้งที่กดใช้งานหรือจำนวนคนออนไลน์ ระบบจำกัดการอ่านที่ 20,000 แถวต่อแหล่งข้อมูลและจะแสดงข้อผิดพลาดแทนตัวเลขที่ถูกตัดทอนเมื่อเกินขีดจำกัด

แท็บ `Roadmap` เป็น visual roadmap ภายในสำหรับวาง milestone และการ์ด Idea/Note/Problem/Decision/Feedback ข้อมูล MVP บันทึกใน `localStorage` ของเบราว์เซอร์ (`classkru-developer-roadmap-v1`) จึงไม่ส่งเข้า Supabase และไม่ซิงก์ข้ามเครื่อง

## Environment Variables บน Vercel

ตั้งค่าทั้ง Production, Preview และ Development ตามความเหมาะสม:

- `DEV_CONSOLE_PASSWORD` — รหัสผ่านที่ผู้ดูแลกำหนด ห้าม commit ลง Git
- `DEV_SESSION_SECRET` — ค่าสุ่มความยาวอย่างน้อย 32 ตัวอักษรสำหรับลงลายเซ็น session (ระบบจะไม่เปิดใช้งานหากสั้นกว่านี้)
- `SUPABASE_URL` — URL ของโครงการ Supabase (หากไม่ตั้ง ระบบใช้ URL ของ ClassKru ปัจจุบัน)
- `SUPABASE_SECRET_KEY` — Secret key รูปแบบ `sb_secret_...` ใช้เฉพาะ Vercel Serverless Functions (แนะนำ)
- `SUPABASE_SERVICE_ROLE_KEY` — รองรับ Legacy service-role key เพื่อความเข้ากันได้ย้อนหลัง

หลังเปลี่ยน Environment Variables ต้อง Redeploy เพื่อให้ deployment ใหม่ได้รับค่า

## Database

รัน `supabase/migrations/202608030001_developer_issue_console.sql` ใน Supabase SQL Editor หรือผ่าน Supabase CLI เมื่อเริ่มติดตั้ง Developer Console

- `issue_reports` — ข้อความจากผู้ใช้ที่เข้าสู่ระบบ พร้อมวันและเวลาที่ฐานข้อมูลบันทึกให้อัตโนมัติ
- RLS policy ให้ผู้ใช้ส่งและอ่านได้เฉพาะรายการของตัวเอง
- ไอเดียและคอมเมนต์ของ Biggy/PetchPetch ใช้ `issue_reports` เดิมผ่าน marker ภายใน และถูกกรองออกจากหน้าความคิดเห็นของผู้ใช้

Developer Console อ่านข้อมูลผ่าน Serverless Function ที่ใช้ service-role key ฝั่งเซิร์ฟเวอร์เท่านั้น

## Security Boundary

- รหัสผ่านไม่อยู่ใน HTML หรือ JavaScript ฝั่งเบราว์เซอร์
- Session cookie เป็น HttpOnly, SameSite=Strict และ Secure บน HTTPS
- API ความคิดเห็นอนุญาตให้อ่านเฉพาะ `issue_reports` และเรียงข้อมูลจากใหม่ไปเก่า
- API ไอเดียเขียนได้เฉพาะ `issue_reports` ผ่าน marker ที่กำหนด และตรวจ Developer Session พร้อม same-origin ทุกครั้ง
- ไม่มี API สำหรับลบข้อมูลหรือรัน SQL
- หน้าและ API ส่ง `Cache-Control: no-store` และถูกตั้ง `noindex`
- การจำกัดจำนวนครั้งที่ลองรหัสผ่านใน Serverless Function เป็น best effort ควรเพิ่ม rate limiting ระดับ Vercel Firewall เมื่อเปิดให้ใช้งานระยะยาว
