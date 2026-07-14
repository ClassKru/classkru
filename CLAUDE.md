# ClassKru — คู่มือสำหรับ Claude Code

แอปเช็คชื่อ/คะแนนสำหรับครูไทย (Vanilla JS + Supabase, deploy บน Vercel).
เอกสารนี้มีไว้ให้ Claude เข้าใจโครงสร้างโดยไม่ต้องสำรวจซ้ำ **เพื่อประหยัด token**

## ⚡ กฎประหยัด token (อ่านก่อนเสมอ)

1. **ห้ามอ่าน `index.html` เต็มไฟล์** (81KB / ~20K tokens). ใช้ `Grep` หา element/id ที่ต้องการ แล้ว `Read` เฉพาะช่วง (offset/limit) เท่านั้น
2. **bump version ใช้สคริปต์ อย่าแก้มือ**: หลังแก้ไฟล์ใน `js/` หรือ `css/` ให้รัน
   ```bash
   ./bump-version.sh        # auto +1 (เช่น 101→102)
   ```
   สคริปต์ bump ทั้ง 21 refs (13 js + 8 css) ให้เอง — **ไม่ต้องอ่าน index.html เข้า context**
   (`logo.png?v=` แยกต่างหาก สคริปต์ไม่แตะ)
3. **ไฟล์ js ก้อนใหญ่** (`reports.js` 859 บรรทัด, `attendance.js`, `scores.js` ~550-670) — ใช้ `Grep -n` หาฟังก์ชันก่อน แล้ว Read เฉพาะช่วง อย่าอ่านทั้งไฟล์
4. อ่านหลายไฟล์พร้อมกันเฉพาะที่จำเป็นจริง — อย่าอ่านเผื่อ

## โครงสร้าง

```
index.html          หน้าเดียว (SPA) — markup ทั้งหมด + โหลด script/css ท้ายไฟล์ (บรรทัด ~779-791)
css/  01..08        แยกตามหน้า (base, dashboard, reports, modal, home, attendance, scores, responsive)
js/   (โหลดตามลำดับ core.js ก่อนเสมอ)
```

| ไฟล์ js | หน้าที่ |
|---------|---------|
| `core.js`        | **โหลดก่อนสุด** — `appState` (global state), init, config, helper วันที่ |
| `auth.js`        | login overlay + Supabase auth |
| `shell.js`       | #hash routing (รองรับลิงก์ตรงจาก LINE OA), nav, การสลับหน้าจอ |
| `dashboard.js`   | หน้าแรก/แดชบอร์ด (ตารางวันนี้, สรุป) |
| `classrooms.js`  | จัดการห้องเรียน |
| `students.js`    | จัดการรายชื่อนักเรียน |
| `timetable.js`   | ตารางสอน (สัปดาห์ A/B) |
| `attendance.js`  | เช็คชื่อ (swipe check-in) — ไฟล์ใหญ่ |
| `reports.js`     | รายงาน/export — ไฟล์ใหญ่สุด (859 บรรทัด) |
| `scores.js`      | คะแนน ปพ.5 (70:10:20) — แก้บ่อย |
| `tools.js`       | เครื่องมือหน้าชั้น (สุ่มชื่อ/จับเวลา ฯลฯ) |
| `extras.js`      | OCR สแกนรายชื่อ (tesseract), ฟีเจอร์เสริม |
| `shared-utils.js`| modal + utility ที่ใช้ร่วมหลายหน้า |

**ลำดับโหลด (ใน index.html):** core → auth → shell → dashboard → classrooms → students → timetable → reports → attendance → scores → tools → shared-utils → extras

## Dependencies (CDN, โหลดใน `<head>`)
supabase-js@2, xlsx@0.18.5 (export Excel), tesseract.js@5 (OCR)

## Workflow / Deploy
- **git-flow**: แก้บน `feature/*` branch → push → เปิด PR → user merge → **Vercel auto-deploy** (ไม่ใช้ `vercel --prod`)
- ก่อน commit ที่แตะ js/css: รัน `./bump-version.sh` แล้ว commit index.html ไปด้วย
- CI เช็ค syntax ของ js ทุกไฟล์

## หมายเหตุ
- แยกไฟล์ js จากไฟล์เดียวเดิมแบบ byte-identical (10 ก.ค.69) — พฤติกรรมต้องเหมือนเดิม
- UI: สะอาด มินิมอล สีเป็น accent, ชอบ animation วิ่ง 0→ค่า
