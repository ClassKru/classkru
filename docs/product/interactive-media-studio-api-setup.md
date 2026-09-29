# Interactive Media Studio — API setup

สถานะ: เปิดใช้ผู้ช่วยวางแผนสื่อจริงผ่าน Vercel Function `POST /api/media-studio/plan` แล้ว แต่ยังไม่สร้างไฟล์เกมหรือเผยแพร่สื่ออัตโนมัติ

## สิ่งที่ endpoint ทำ

- ต้องมี Supabase access token ของครูใน `Authorization: Bearer <token>`
- รับเฉพาะข้อความของครู ประวัติการคุยช่วงล่าสุด และบริบทวิชา/ห้อง/เวลา
- หน้าเว็บไม่ส่งรายชื่อนักเรียนหรือผลการเรียนรายบุคคล
- เรียก OpenAI Responses API ด้วย Structured Outputs และ `store: false`
- คืน `assistant_message`, ทางเลือกสื่อ 1–3 ทาง และคำถามต่อยอด; ไม่มีการบันทึกบทสนทนาหรือร่างลงฐานข้อมูลในรอบนี้
- ใช้ rate limit ใน memory 8 คำขอต่อครูต่อ 60 วินาที (best effort ต่อ Vercel instance)

## ตั้งค่า Vercel

ตั้ง Environment Variables สำหรับ Preview และ Production:

```text
OPENAI_API_KEY=...                 # secret, ห้ามใส่ในไฟล์หรือ frontend
OPENAI_MEDIA_STUDIO_MODEL=gpt-5.6-luna  # optional; ปรับได้ตาม model ที่บัญชีเข้าถึง
```

ไม่ต้องตั้ง `SUPABASE_URL` หรือ `SUPABASE_PUBLISHABLE_KEY` หากใช้โครงการ Supabase ปัจจุบัน; endpoint มีค่า public fallback เฉพาะสำหรับตรวจ session. หากเปลี่ยน Supabase project ให้ตั้งทั้งสองค่านี้ใน Vercel ด้วย

## ทดสอบ

1. ตั้ง secret บน Vercel แล้ว deploy Preview
2. เข้าสู่ระบบ ClassKru ใน Preview นั้น
3. ไปที่เครื่องมือ > “สร้างสื่อกับ AI” แล้วพิมพ์ไอเดียสั้น ๆ
4. ยืนยันว่า AI คืนทางเลือก, เลือกหนึ่งแนว และกด “ยืนยันใช้ร่างนี้”
5. ตรวจ Vercel Function logs โดยใช้ `request_id` ของ OpenAI หากจำเป็น; ห้ามบันทึกข้อความของครูหรือ token ใน log

`python -m http.server` ใช้ทดสอบ frontend ได้ แต่ไม่สามารถรัน `/api/*` ของ Vercel ได้. สำหรับ local API ใช้ `vercel dev` หลังตั้ง `OPENAI_API_KEY` ใน environment ของเครื่องเท่านั้น.

## ขอบเขตความปลอดภัย

รอบนี้เป็น AI planner ไม่ใช่ AI Custom Studio: AI ไม่มีสิทธิ์สร้าง/รัน HTML, JavaScript หรือ asset bundle และไม่มีสิทธิ์เข้าถึงรายชื่อนักเรียน, Source Pack, Storage หรือ Supabase admin key. การสร้างสื่ออิสระต้องเดินตามแนวทางใน `interactive-media-studio-security.md` แยกต่างหาก.
