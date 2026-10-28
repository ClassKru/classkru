# ClassKru AI Chat

ฟีเจอร์ผู้ช่วยแชต ClassKru AI และตัวเลือกบรีฟ/โมเดลสำหรับบัญชี Developer

## โครงสร้าง

- `frontend/` — JavaScript และ CSS ของปุ่มเปิดแชต, หน้าต่างสนทนา, ตัวเลือกบรีฟและโมเดล
- `server/handlers/` — ตัวจัดการ API ของบทสนทนาและการตั้งค่า Developer
- `server/lib/` — การเรียก AI, รายการโมเดล, การตรวจ action และการอ่านบรีฟ
- `briefs/` — system/navigation prompts และ config แยกเวอร์ชัน ใช้ฝั่ง server เท่านั้น
- `assets/` — action allowlist และภาพอ้างอิงของปุ่ม
- `docs/` — บันทึกการออกแบบและการตั้งค่า
- `tests/` — automated checks ที่เกี่ยวข้องกับ ClassKru AI Chat

## จุดเชื่อมต่อในแอปหลัก

ไฟล์เหล่านี้อยู่ที่รากโปรเจกต์เพราะระบบแอปและ Vercel ต้องใช้ตำแหน่งมาตรฐาน:

- `index.html` โหลด frontend จากโฟลเดอร์นี้
- URL `/api/ai/{navigation,brief-versions,model-settings}` ใช้ Vercel rewrites ไปยัง `api/media-studio/index.js` และส่งต่อเข้า `server/handlers/gateway.js` เพื่อคงจำนวน Functions ไม่เกิน 12
- `api/_lib/` มี auth และ HTTP helpers ที่แชร์กับ API อื่นใน ClassKru
- `scripts/media-dev.cjs`, `vercel.json` และ `.vercelignore` เชื่อมการรัน local และ deploy

แก้ตรรกะของฟีเจอร์ในโฟลเดอร์นี้เป็นหลัก ส่วนไฟล์ทางเข้าที่รากให้คงไว้เป็นจุดเชื่อมต่อ

## บรีฟและ API key

แต่ละเวอร์ชันอยู่ใน `briefs/versions/<id>/` พร้อม `system.md`, `navigation.md` และ `config.json`; เพิ่มรายการที่ `briefs/registry.json` บรีฟไม่ถูกเสิร์ฟเป็นไฟล์ static และ API key ต้องอยู่ใน environment ฝั่ง server เท่านั้น

รายละเอียดการทำงานและการตั้งค่าอยู่ที่ [เอกสาร Navigation V1](docs/classkru-ai-navigation-v1.md) และ [แนวทางจัดการบรีฟ](briefs/README.md)
