# Media Studio — สถานะจริงและคู่มือติดตั้ง

อัปเดต 20 กันยายน 2569 · branch `feature/media-studio-live` · [PR #75](https://github.com/ClassKru/classkru/pull/75)

## สถานะปัจจุบัน

ตามคำขอผู้ใช้ เปลี่ยน Media Studio ให้เก็บ **ไฟล์ JSON เข้ารหัสใน Supabase Storage เดิม โดยไม่สร้างตาราง SQL เพิ่ม** ใช้ Supabase Auth และ OpenRouter เดิม ส่วนข้อมูลเช็กชื่อ/คะแนน/ระบบอื่นไม่ถูกเปลี่ยนวิธีจัดเก็บ

โค้ดและการทดสอบในเครื่องพร้อมส่งตรวจ แต่ **ยังไม่ยืนยันการใช้งานออนไลน์กับ AI/Supabase จริง** ต้องตั้ง server env, ตรวจ Storage policies และสร้างเว็บเปิดสื่อในทีม ClassKru ก่อน เครื่องนี้ยังไม่มีสิทธิ์ Vercel ทีม `classkru-dev` หรือ Supabase server credentials จึงไม่ deploy ไปบัญชี DOAI แทน

[Preview](https://classkru-git-feature-media-studio-live-classkru-dev.vercel.app) ยังมี Vercel Deployment Protection การเปิดแบบไม่ล็อกอินตอบ 302; ระบบหลักมี 11 Serverless Functions หลังรวม Word export 4 URL ไว้ใน handler เดียวแล้ว ไม่ต้องเพิ่มแพลนเพื่อแก้ function-count error เดิม

## ครูใช้งานอย่างไร

1. เข้าจากหน้าวันนี้ เครื่องมือ หรือ **คลังสื่อ → เกมและแบบจำลองกับ AI** ด้วยบัญชีเดิม
2. พิมพ์ไอเดีย → AI ช่วยคิด ถามต่อ และแยกเป้าหมาย/สิ่งที่เด็กเห็น/ตัวแปร/ภารกิจ
3. กดสร้าง → AI เขียน HTML/CSS/JavaScript ใหม่อย่างอิสระ ไม่ได้เลือกจาก template เกมตายตัว
4. ระบบตรวจโค้ดและทดลองใน Chromium ที่ 390/1280px → บันทึกไฟล์เวอร์ชันใหม่
5. ครูทดลองเล่นบนเว็บสื่อแยกและยืนยันตรวจเนื้อหา → เผยแพร่ลิงก์ให้นักเรียน
6. กลับมาคุยต่อ สร้างเวอร์ชันใหม่ ปิดลิงก์ หรือเก็บเข้ากรุ/นำกลับได้

สร้างสื่อแต่ละชิ้น **ไม่ต้อง commit หรือ deploy ใหม่**: deploy ระบบหลักกับเว็บเปิดสื่อครั้งแรก แล้วผลงานแต่ละชิ้นเป็นข้อมูลใน Storage ครูหลายคนใช้เว็บเปิดสื่อเดียวกัน แต่สิทธิ์จัดการตรวจด้วย ID บัญชีครูจาก Supabase Auth ที่เซิร์ฟเวอร์

รองรับสื่อ self-contained: HTML/CSS/JS, canvas และ SVG พื้นฐาน ไม่รองรับ npm/React/CDN, network, iframe ของผู้สร้าง, ภาพ/เสียงแนบ, server code หรือฐานข้อมูลภายในเกม ไม่มี Source Pack/ค้นแหล่งอ้างอิง/ส่งคะแนนกลับระบบในรุ่นนี้ และยังไม่ได้ fine-tune AI ครูต้องตรวจความถูกต้องทางวิชาการ

## เก็บอะไรไว้ที่ไหน

ทุกไฟล์อยู่ใน private bucket `classkru-media-files` (เปลี่ยนชื่อได้ผ่าน env) เนื้อไฟล์เป็น JSON envelope เข้ารหัส AES-256-GCM ผูกกับชื่อ bucket และ path การย้าย ciphertext ไปปลอมเป็นไฟล์อีกชื่อจะตรวจไม่ผ่าน

| ข้อมูล | Path ภายใน bucket |
|---|---|
| งานและบริบท | `users/{teacher}/projects/{project}.json` |
| ข้อความครู/คำขอ | `users/{teacher}/jobs/{project}_{request}.json` |
| แผนและคำตอบ AI | `users/{teacher}/results/plan/{project}_{request}.json` |
| เวอร์ชัน hash ผลตรวจ และคำตอบ AI | `users/{teacher}/results/build/{project}_{request}.json` |
| โค้ดสื่อ | `users/{teacher}/artifacts/{project}_{request}.json` |
| สถานะเริ่มงาน/ล้มเหลว | `users/{teacher}/claims/...`, `results/failed/...` |
| ประวัติเก็บเข้ากรุ | `users/{teacher}/archives/{project}/{sequence}.json` |
| ดัชนีลิงก์ของครู | `users/{teacher}/links/{kind}/...` |
| สิทธิ์เปิดสื่อ/การเพิกถอน | `links/{token}.json`, `revoked/{token}.json` |
| โควตารายวัน/ตัวกันงานซ้ำ | `users/{teacher}/quota/{day}/...`, `leases/...` |

ทุกการเขียนเป็น **สร้างไฟล์ใหม่ ไม่เขียนทับหรือลบไฟล์เดิม** คำขอหนึ่งครั้งใช้ UUID เป็น idempotency key ผลสำเร็จหนึ่งไฟล์รวมคำตอบ AI กับแผน/เวอร์ชันไว้ด้วยกัน ไม่แยก commit สองส่วน บทสนทนาที่เห็นประกอบจากไฟล์เหล่านี้ ไม่ใช่ไฟล์แชทก้อนเดียวที่หลายแท็บเขียนทับกัน

นี่ไม่ใช่ธุรกรรม SQL ข้ามหลายไฟล์: ถ้าขาดการเชื่อมต่ออาจมีไฟล์ส่วนตัวที่ยังไม่ถูกอ้างอิง ระบบไม่เผยแพร่และไม่ลบทิ้งโดยเดาว่าไม่สำเร็จ เมื่อคำขอตอบกลับหายหลังอัปโหลดผลแล้ว จะค้นหาผลที่บันทึกไว้ก่อน ไม่เรียก AI ใหม่อัตโนมัติ

## ติดตั้งก่อนใช้งานออนไลน์

ทำใน **บัญชี Supabase/Vercel ของ ClassKru** ไม่ส่ง secret ในแชท ไม่ต้องเปิด SQL Editor สำหรับ Media Studio รุ่นนี้

### 1. Vercel โปรเจกต์หลัก

Node.js 24.x, ใช้ package-lock, Fluid Compute และ function `api/media-studio/index.js` มี `maxDuration: 300` ตาม `vercel.json` ตรวจข้อจำกัดของบัญชีจริงก่อนใช้งาน

| Server environment | วิธีใช้ |
|---|---|
| `OPENROUTER_API_KEY` | ใช้ key เดิมของคลังสื่อ |
| `OPENROUTER_MEDIA_MODEL` | ไม่บังคับ; ใช้ `OPENROUTER_MODEL` หรือค่าเริ่มต้นในโค้ด |
| `SUPABASE_URL` | Supabase ClassKru เดิม |
| `SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_ANON_KEY` | public Auth key โครงการเดียวกัน |
| `SUPABASE_SECRET_KEY` / `SUPABASE_SERVICE_ROLE_KEY` | server-only สำหรับ Storage |
| `MEDIA_STORAGE_KEY` | กุญแจเข้ารหัสสุ่ม 32 bytes เขียนเป็น hex 64 ตัวอักษร |
| `MEDIA_STORAGE_BUCKET` | ไม่บังคับ; ค่าเริ่มต้น `classkru-media-files` |
| `CLASSKRU_APP_ORIGIN` | origin เว็บหลัก |
| `MEDIA_ORIGIN` | origin เว็บเปิดสื่อจากข้อ 3 ต้องต่างจากเว็บหลัก |

สร้างกุญแจเข้ารหัสครั้งเดียวบนเครื่องที่เชื่อถือ แล้วนำไปตั้งใน Vercel Environment Variables:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

**สำรองกุญแจใน password manager ของผู้ดูแล ห้าม commit หรือส่งมาในแชท** ทุก instance ที่ใช้ bucket เดียวกันต้องใช้กุญแจเดียวกัน หากหายจะอ่านไฟล์เดิมไม่ได้ การเปลี่ยนกุญแจต้องทำแผน re-encrypt ไม่ใช่สุ่มค่าใหม่แล้ว redeploy รุ่นนี้ยังไม่มีเครื่องมือหมุนกุญแจอัตโนมัติ

แนะนำให้ Preview ใช้ bucket แยก เช่น `classkru-media-preview` และกุญแจแยก เพื่อไม่เขียนปนกับ Production

ถ้ามี OpenRouter key ระบบจะใช้ก่อนเสมอ ถ้าไม่มีจึงใช้ `OPENAI_API_KEY`/`OPENAI_MEDIA_STUDIO_MODEL` เป็นทางเลือก ไม่เปลี่ยน provider เมื่อ request ล้มเหลวเพื่อหลีกเลี่ยงคิดเงินซ้ำ ไม่ต้องขอ OpenAI key เพิ่มเมื่อใช้ OpenRouter เดิม

### 2. Storage อัตโนมัติ

เมื่อครูสร้างงานแรก เซิร์ฟเวอร์ตรวจ bucket และสร้างให้อัตโนมัติถ้ายังไม่มี โดยตั้ง private, MIME JSON และขนาดสูงสุด 1 MiB ถ้าพบ bucket ชื่อนี้เป็น public ระบบหยุด ไม่เปลี่ยน bucket ที่มีอยู่เอง

ไม่ต้องเพิ่ม policy ให้ browser อ่าน/เขียน bucket นี้ เซิร์ฟเวอร์ตรวจ session กับ Supabase Auth ก่อน แล้วใช้ server key จัดการไฟล์ ครูจึงไม่ต้องมีสิทธิ์ Storage โดยตรง การแชร์ผ่าน public API คืนเฉพาะสื่อที่ตรวจ token, archive epoch, การเพิกถอน, review และ hash แล้ว ไม่คืนแชทหรือกุญแจ

**ต้องตรวจ policies เดิมก่อนเปิดใช้จริง**: private bucket ไม่ได้ลบกฎ RLS เก่าที่อาจเปิดทุก bucket กว้างเกินไป และการเข้ารหัสไม่ป้องกันการลบ ciphertext/rollback ประวัติจากผู้ที่มีสิทธิ์ Storage write/delete ตรวจด้วย anon และบัญชีครูสองบัญชีว่าไม่สามารถ list/read/upload/overwrite/delete ไฟล์ตรงได้ หากมีกฎกว้าง ให้ผู้ดูแลจำกัดกฎเดิมผ่านหน้า Storage policies ก่อนเปิด pilot ไม่อ้างว่าการเข้ารหัสแทน access control ได้ทั้งหมด

### 3. เว็บเปิดสื่อแยก

- Import repository เดิมเป็นอีก Vercel project ในทีม ClassKru
- Root Directory: `media-host`; Framework: Other; ไม่มี build command
- ตั้งเพียง `CLASSKRU_APP_ORIGIN`; **ห้ามใส่ AI/Supabase/Storage encryption key ในโปรเจกต์นี้**
- นำ origin `.vercel.app` ที่ได้จริงมาตั้ง `MEDIA_ORIGIN` ในโปรเจกต์หลัก
- ทดลองลิงก์นักเรียนจากหน้าต่างส่วนตัว ต้องไม่ติด Vercel login
- Preview ต้องจับคู่ app/media origin และให้ media server เรียก public API หลักได้ ไม่ปิด Deployment Protection โดยเดา
- wrapper ที่เชื่อถือได้อยู่คนละ origin กับ ClassKru; ตัวเกมอยู่ iframe `sandbox="allow-scripts"` โดยไม่มี `allow-same-origin`

การใช้งานมีโควตาและค่า AI/Storage/compute ตามบัญชี ไม่รับประกันใช้ฟรีเมื่อขยายจำนวนครู

### 4. ตรวจรับก่อน merge/เปิดใช้

- [ ] ตั้ง env และสำรองกุญแจเข้ารหัส
- [ ] สร้างงานจริง ตรวจ auto-create private bucket และ Auth/Storage permissions สองบัญชี
- [ ] แชท → สร้างด้วย AI จริง → ทดลอง → ปรับ → เปิดงานเดิม
- [ ] เปิดลิงก์โดยไม่ล็อกอิน ปิดแล้วโหลดใหม่ได้ 404
- [ ] เก็บเข้ากรุแล้วนำกลับไม่คืนสิทธิ์ลิงก์เก่า
- [ ] Chrome มือถือ/คอม และ Safari อุปกรณ์ใช้งานจริง
- [ ] ตรวจเวลา/หน่วยความจำ Chromium, ค่า AI, จำนวน Storage requests/egress
- [ ] ตั้งงบ แจ้งเตือน และ public API rate limits ตามปริมาณใช้งาน

## คิวและข้อจำกัด

Lease journal แบบเพิ่มไฟล์ใหม่ใช้ exclusive upload เพื่อเลือกผู้ถือสิทธิ์: สูงสุด 2 งานพร้อมกันทั้งระบบและ 1 งานต่อครู การปล่อยสิทธิ์เขียน marker ของ sequence เดิม จึงไม่ปลดล็อกงานรุ่นถัดไปโดยกระบวนการที่มาช้า TTL 6 นาที มากกว่า function lifetime 300 วินาที ห้ามเพิ่ม function timeout เกิน lease โดยไม่ปรับ/ทดสอบการประสานงานด้วย

การรับคำขอ/สร้างงาน/แชร์/เก็บเข้ากรุใช้ admission lease ต่อครู หากชนกันตอบว่า workspace กำลังบันทึก ให้ลองใหม่ ถ้า instance หายอาจต้องรอไม่เกิน 6 นาที ไม่ลบ lock แล้วเสี่ยงสอง process เขียนพร้อมกัน

ขีดจำกัด pilot: 100 projects ต่อครู (รวมเข้ากรุ), 30 เวอร์ชันต่องาน, 3 งาน queued/running ต่อครู, **40 คำขอ plan/build ต่อวันปฏิทินเวลาไทย** (ไม่ใช่ rolling 24h แบบ SQL เดิม), ลิงก์ใหม่ชนิดละ 200 ต่องานรวมลิงก์หมดอายุ/เพิกถอน คำขอที่จองโควตาแล้วแต่เขียนงานไม่สำเร็จอาจใช้โควตานั้นไปด้วย

คิวเก็บถาวรแต่ยังไม่มี scheduler อิสระ หน้า Studio ที่เปิดงานเริ่มงาน queued และตรวจเฉพาะสถานะทุก 5 วินาที โหลดประวัติเต็มเมื่อสถานะเปลี่ยน ถ้าปิดก่อนเริ่มให้เปิดงานนั้นใหม่เพื่อเริ่ม งาน queued เกิน 24 ชั่วโมงหรือ running เกิน 6 นาทีแสดงล้มเหลว ไม่มีการ retry AI อัตโนมัติ ครูส่งคำขอใหม่เองได้

ไฟล์จำนวนมากทำให้ค้นหา/โหลดช้ากว่าฐานข้อมูลที่มีดัชนี รุ่นนี้จำกัดการอ่านประวัติล่าสุด 120 ข้อความบนหน้าจอ (ไฟล์เก่ายังคงอยู่) และใช้ parallel reads แบบจำกัด ก่อนเปิดกว้างต้องวัดโหลดจริง เพิ่ม worker/monitoring และแผน snapshot/index/retention ไม่ใช่อ้างว่ารองรับครูไม่จำกัด

## ความปลอดภัยและข้อจำกัดที่ยังเหลือ

- Scanner เป็น defense-in-depth ไม่ใช่หลักฐานว่าสื่อปลอดภัย; ขอบเขตหลักคือ origin แยก + iframe sandbox + CSP
- เกมไม่รับ session/รายชื่อนักเรียน/คะแนน/secret ไม่มี network, storage, popup, form submit, camera หรือ microphone
- AI ได้เฉพาะข้อความครูและบริบทวิชา/ห้อง/เป้าหมาย ครูไม่ควรพิมพ์ข้อมูลส่วนตัวนักเรียน
- Chromium smoke test ไม่พิสูจน์ความถูกต้องทางวิชาการหรือป้องกัน browser zero-day ได้ทั้งหมด
- Serverless Chromium ใช้ OS flag `--no-sandbox` แต่ iframe sandbox และ web/site isolation ยังทำงาน และ browser process ไม่ได้รับ secret ผ่าน env ก่อนเปิดกว้างควรย้ายการรันโค้ดไป worker แยกจาก service ที่ถือ secret
- Preview token อายุ 15 นาที published อยู่จนถูกปิด/เก็บเข้ากรุ ใครได้ลิงก์เปิดได้; เพิกถอนไม่เรียกคืนไฟล์ที่ถูกเปิด/คัดลอกแล้ว
- ไม่มีลบถาวร/retention/cleanup อัตโนมัติ เก็บไฟล์ orphan, lease และ revoke markers ไว้ ห้ามลบ journal/revoke files โดยพลการ เพราะอาจทำให้ replay/ลิงก์เก่ากลับมาใช้ได้
- ไม่บันทึก auth header, API key, encryption key หรือ share token ใน log

## ผู้ที่เคยติดตั้ง SQL รุ่นเก่า

ไฟล์ `202609190001_media_studio.sql` ย้ายไป `docs/product/history/` เป็นหลักฐานการออกแบบเก่า **ไม่ต้องรันสำหรับรุ่นนี้** ไม่ได้ drop ตาราง ลบ bucket `media-bundles` หรือย้ายข้อมูลในบัญชีจริง

ถ้าเคยใช้ SQL pilot และมีสื่อแล้ว ให้เก็บ deployment/ข้อมูลเดิมไว้ก่อน รุ่นไฟล์นี้ไม่อ่านหรือย้ายงาน SQL ให้อัตโนมัติ ต้องสำรวจและวางแผนโอนข้อมูลโดยเฉพาะก่อนสลับระบบ ห้ามอ้างว่างานเก่าถูกย้ายแล้ว

## ทดสอบและส่งขึ้น Git

ใน `C:\Users\USER\ClassKru\_worktrees\media-studio-live`:

```powershell
npm.cmd ci --ignore-scripts
npm.cmd run test:media
npm.cmd run test:media:browser
```

Unit/integration ใช้ตัวจำลอง HTTP ของ Storage ผ่าน REST adapter และ encryption จริง ตรวจ owner isolation, quotas, concurrent leases, idempotency, timeouts, archive/revoke/hash และ Auth API ส่วน browser ใช้สอง HTTP origins กับ AI fixture ตรวจ UI และ sandbox ทั้งหมดนี้ **ไม่ใช่ผลทดสอบ Supabase/AI Production**

ทดสอบ API จริงโดยคัดลอก `.env.example` เป็น `.env.local` และใส่ค่าฝั่งเซิร์ฟเวอร์เฉพาะในเครื่อง:

```powershell
npm.cmd run dev:media
```

เปิด `http://127.0.0.1:3511`; เว็บสื่อใช้ `http://127.0.0.1:3512` Windows ใช้ Chrome ที่ติดตั้งหรือกำหนด `MEDIA_BROWSER_EXECUTABLE` การใช้ `python -m http.server` อย่างเดียวรัน API ไม่ได้

workflow: feature → push → PR → ผู้ใช้ merge → Vercel auto-deploy ไม่ push main/ใช้ `vercel --prod` แทน และไม่ deploy ข้ามทีมเอง

อ้างอิงพฤติกรรม Storage: [exclusive upload และการอัปโหลดพร้อมกัน](https://supabase.com/docs/guides/storage/uploads/standard-uploads), [private download endpoint](https://supabase.com/docs/guides/storage/serving/downloads), [Storage access control](https://supabase.com/docs/guides/storage/security/access-control)
