# Media Studio — สถานะจริงและคู่มือติดตั้ง

อัปเดต 19 กันยายน 2569 · โค้ดบน `feature/media-studio-live` จาก `origin/main` commit `687a617`

ส่งขึ้น [PR #75](https://github.com/ClassKru/classkru/pull/75) แล้ว; code commit `21e512e` **ผ่านทั้ง CI และ Vercel Preview** หลังรวมการส่งออก Word เหลือฟังก์ชันเดียว ทำให้ทั้งแอปเหลือ **11 functions** แก้ข้อผิดพลาดเกินเพดาน Hobby 12 ตัว โดยคง URL เดิมไว้ การตรวจครอบคลุม SQL/security 8 tests, export/เอกสาร 10 tests, browser integration และ syntax

เปิด [เว็บตัวอย่าง](https://classkru-git-feature-media-studio-live-classkru-dev.vercel.app) ด้วยบัญชี Vercel ที่มีสิทธิ์ (ยังมี Deployment Protection; คำขอแบบไม่ล็อกอินตอบ 302 ไป Vercel Authentication) **ยังไม่ merge/เปิด Production และยังต้องตั้งค่าฐานข้อมูลกับเว็บเปิดสื่อแยก** จึงยังไม่ยืนยัน end-to-end กับ AI/บัญชีครูจริงบนออนไลน์

## สิ่งที่สร้างแล้ว

ครูเข้าจากหน้าวันนี้ เครื่องมือ หรือ **คลังสื่อ → เกมและแบบจำลองกับ AI** ใช้บัญชี Supabase เดิม ไม่สมัครบัญชีใหม่:

1. พิมพ์ไอเดีย → AI ช่วยวางแผน ถามต่อ และแยกเป้าหมาย/สิ่งที่เด็กเห็น/ตัวแปร/ภารกิจ
2. กดสร้าง → AI เขียน HTML/CSS/JavaScript ใหม่อย่างอิสระ ไม่ได้เลือกจาก template เกมตายตัว
3. ระบบตรวจ markup, CSS, JavaScript และเปิดทดสอบใน Chromium ที่ความกว้าง 390/1280px
4. บันทึกไฟล์ private พร้อม hash และเวอร์ชัน → ครูทดลองเล่นในเว็บสื่อแยก
5. ครูยืนยันตรวจเนื้อหา → เผยแพร่ลิงก์เฉพาะเวอร์ชัน → นักเรียนเปิดเล่นโดยไม่ต้องล็อกอิน
6. ครูคุยต่อ สร้างเวอร์ชันใหม่ เปิดเวอร์ชันเก่า ปิดลิงก์ หรือเก็บงานเข้ากรุ/นำกลับได้

การสร้างสื่อแต่ละชิ้น **ไม่ต้อง commit หรือ deploy ใหม่**: deploy ระบบหลักและเว็บเปิดสื่อครั้งแรก แล้วเก็บผลงานเป็นข้อมูลใน Supabase ครูหลายคนใช้ media origin เดียวกัน แต่สิทธิ์แก้ไขแยกตาม `teacher_id` เดิม

## ขอบเขตที่รองรับจริง

- สื่อ self-contained: HTML/CSS/JavaScript, canvas และ inline SVG พื้นฐาน
- ไม่รองรับ npm/React/CDN, network, iframe ซ้อนจากผู้สร้าง, ไฟล์แนบ, อัปโหลดภาพ/เสียง, server code หรือฐานข้อมูลภายในเกม
- ไม่ส่งรายชื่อนักเรียน คะแนน หรือ session ครูไปให้ AI/เกม ส่งเฉพาะข้อความที่พิมพ์และบริบทวิชา/ห้อง/เป้าหมาย
- มี system prompt สำหรับผู้ช่วยออกแบบและผู้เขียนสื่อ แต่ **ยังไม่ได้ fine-tune** และไม่รับประกันความถูกต้องทางวิชาการ
- ไม่มีระบบ Source Pack/ค้นแหล่งอ้างอิง/ส่งคะแนนเกมเข้าระบบในรุ่นนี้ เอกสารแนวคิดเดิมเป็น roadmap ไม่ใช่รายการที่ทำครบแล้ว
- การแชทและไฟล์บันทึกในบัญชีครู แม้ปิดหน้าต่างแล้วเปิดใหม่ ไม่ได้เก็บความจำหลักไว้ในไฟล์ `.md`

## เก็บอะไรไว้ที่ไหน

| ข้อมูล | ที่เก็บ |
|---|---|
| บัญชีครู | Supabase Auth เดิม |
| งาน บริบท แผน | `media_projects` |
| บทสนทนา | `media_turns` |
| คิว สถานะ ข้อผิดพลาด | `media_jobs` |
| เวอร์ชัน hash ผลตรวจ | `media_versions` |
| ลิงก์ preview/published สถานะเพิกถอน | `media_links` |
| เหตุการณ์เผยแพร่/ปิดลิงก์/เก็บเข้ากรุ | `media_events` |
| HTML/CSS/JS bundle | private bucket `media-bundles/{teacherId}/{projectId}/{versionId}.json` |

RLS อ่านได้เฉพาะเจ้าของ; browser ไม่มีสิทธิ์เขียนตาราง media หรืออ่าน bucket โดยตรง RPC เขียนข้อมูลอนุญาตเฉพาะ service role การเผยแพร่ไม่เปลี่ยน bucket เป็น public

## ติดตั้งก่อนใช้งานออนไลน์

ยังต้องทำขั้นตอนนี้ใน **บัญชี Vercel และ Supabase ของ ClassKru จริง** ไม่ใช่โปรเจกต์ DOAI และไม่ส่ง secret มาในแชท

### 1. ฐานข้อมูลเดิม

สำรองฐานข้อมูลตามกระบวนการโครงการ แล้วรัน migration **ครั้งเดียว** ผ่าน Supabase migration workflow หรือ SQL Editor:

`supabase/migrations/202609190001_media_studio.sql`

ไฟล์อยู่ใน transaction สร้างเฉพาะตาราง/RPC/policy media ไม่ย้ายข้อมูลคะแนนหรือเช็กชื่อเดิม มี restrictive Storage policy กันกฎเก่าที่เปิดทุก bucket กว้างเกินไป การทดสอบในเครื่องใช้ PostgreSQL ผ่าน PGlite ไม่ใช่การยืนยันว่า migration รันบน Production แล้ว

### 2. Vercel โปรเจกต์ ClassKru หลัก

ตั้ง Node.js **24.x**, ใช้ package-lock และ Fluid Compute โดย function สร้างสื่อตั้ง `maxDuration: 300` ใน `vercel.json` ต้องตรวจข้อจำกัดบัญชีจริงก่อนเปิดใช้

การส่งออกเอกสารเดิม 4 URL (`/api/exports/worksheet-docx`, `quiz-docx`, `lesson-plan-docx`, `lesson-pack-docx`) ใช้ rewrite ไปยัง `api/exports/index.js` ร่วมกัน ห้ามเพิ่มไฟล์ handler แยกกลับใน `api/exports/` โดยไม่ตรวจจำนวน functions; implementation ย้ายไป `api/_lib/exports/` ซึ่งไม่ใช่ endpoint สาธารณะ

Environment variables ฝั่งเซิร์ฟเวอร์:

| ชื่อ | ค่า |
|---|---|
| `OPENROUTER_API_KEY` | ใช้ key เดิมของคลังสื่อ ไม่ต้องขอ OpenAI key เพิ่ม |
| `OPENROUTER_MEDIA_MODEL` | ไม่บังคับ; ถ้าไม่ตั้งใช้ `OPENROUTER_MODEL` หรือ `qwen/qwen3-30b-a3b-instruct-2507` |
| `SUPABASE_URL` | URL ของ Supabase ClassKru เดิม |
| `SUPABASE_PUBLISHABLE_KEY` หรือ `SUPABASE_ANON_KEY` | public auth key ของโครงการเดียวกัน |
| `SUPABASE_SECRET_KEY` หรือ `SUPABASE_SERVICE_ROLE_KEY` | server-only key สำหรับฐานข้อมูลและ Storage |
| `CLASSKRU_APP_ORIGIN` | origin ของเว็บหลัก เช่น `https://classkru-kohl.vercel.app` |
| `MEDIA_ORIGIN` | origin ของ media project ที่ได้จริงจากข้อ 3 ต้องต่างจากเว็บหลัก |

ถ้ามี OpenRouter key ระบบจะใช้ OpenRouter ก่อนเสมอ หากไม่มีจึงรองรับ `OPENAI_API_KEY` + `OPENAI_MEDIA_STUDIO_MODEL` เป็นทางเลือก ไม่เปลี่ยน provider อัตโนมัติเมื่อคำขอเดิมล้มเหลวเพื่อหลีกเลี่ยงการคิดค่าใช้จ่ายซ้ำ

OpenRouter ตั้ง `provider.data_collection=deny` และตรวจ JSON ที่ตอบกลับ; ถ้าโมเดล/ผู้ให้บริการไม่รองรับข้อกำหนดหรือสร้างโค้ดไม่ครบจะแจ้งข้อผิดพลาด ไม่เผยแพร่โค้ดบางส่วน การเลือกโมเดลจริงต้องทดสอบกับ key ของโครงการ

### 3. Vercel โปรเจกต์เว็บเปิดสื่อ

- Import Git repository เดิมเป็นอีกโปรเจกต์ ในบัญชี/ทีม ClassKru
- Root Directory: **`media-host`**; Framework: Other; ไม่มี build command; ไม่ต้องซื้อโดเมนเพื่อเริ่มทดลอง
- ตั้งเพียง `CLASSKRU_APP_ORIGIN` ให้ตรงกับเว็บหลัก
- ไม่ใส่ AI key, Supabase key หรือ credential ใด ๆ ในโปรเจกต์นี้
- ใช้ URL `.vercel.app` ที่ Vercel จัดให้จริง แล้วนำไปใส่ `MEDIA_ORIGIN` ของโปรเจกต์หลัก ค่าใน `.env.example` จึงเว้นว่างไว้จนกว่าจะสร้างเว็บสื่อจริง
- ลิงก์นักเรียนต้องไม่ติด Deployment Protection/login ของ Vercel ตรวจการเปิดจากหน้าต่างส่วนตัวก่อนใช้ในห้องเรียน
- Preview environment ต้องจับคู่ app/media origin ให้ตรงกันและให้ media server เรียก public API ได้ อย่าคาดว่า preview ที่ป้องกันด้วย login จะทำงานเหมือน Production
- server ของ media host เรียก public API ของ main เพื่อรับสื่อ ตัวเกมอยู่ใน iframe ที่ใช้ `sandbox="allow-scripts"` ไม่ให้ `allow-same-origin`

โครงการเพิ่มและการใช้งานยังขึ้นกับโควตา/แผน Vercel, Supabase และค่า AI ไม่รับประกันว่าใช้งานจำนวนมากฟรี ตรวจงบประมาณและ rate limit ของบัญชีก่อนเปิดครูทุกคน

### 4. ตรวจรับก่อน merge/เปิด Production

- [ ] ติดตั้ง migration และตรวจ private bucket/policies
- [ ] ตั้ง environment variables ทั้งสองโปรเจกต์ แล้ว redeploy ให้รับค่าใหม่
- [ ] ใช้บัญชีครูจริง คุยวางแผน → สร้าง → ปรับตัวแปร → เปิดงานเดิม
- [ ] สองบัญชีมองไม่เห็น/แก้ไขงานของกันและกัน
- [ ] ทดสอบเผยแพร่และเปิดลิงก์โดยไม่ล็อกอิน
- [ ] ปิดลิงก์แล้วเปิดใหม่ได้ 404; เวอร์ชันเดิมไม่ถูกแก้ทับ
- [ ] ตรวจ Chrome มือถือ/คอม และอุปกรณ์ Safari ที่ใช้จริง
- [ ] ตรวจ function memory/duration, Chromium bundle และค่าใช้จ่าย AI จริง
- [ ] ตั้งงบ/แจ้งเตือนผู้ให้บริการและกฎ WAF/rate limit ของ public endpoint ตามปริมาณผู้ใช้

## คิวและข้อจำกัดหลายผู้ใช้

RPC ล็อกการจองงานในฐานข้อมูล: ทำงานได้รวม 2 งานพร้อมกัน, ครูละ 1 งาน, ครูหนึ่งคนมีงาน queued/running รวมไม่เกิน 3 งาน, 40 คำขอ plan/build ในรอบ 24 ชั่วโมง, 100 projects และ 30 versions ต่อ project การเก็บเข้ากรุไม่คืนโควตาจำนวน projects

คิวบันทึกถาวร แต่ **ยังไม่มี background scheduler อิสระ**: หน้า Studio ที่เปิดงานอยู่เรียก `run` และ poll คิว หากปิดก่อนเริ่ม งานรอจะเริ่มอีกครั้งเมื่อเปิดงานนั้น การปิดแท็บระหว่างสร้างอาจทำให้ function จบหรือหมดเวลา ขึ้นกับ runtime งาน running เกิน 5 นาทีแสดง failed ไม่แอบ retry/คิดเงินใหม่ ครูส่งคำขอใหม่เองได้ คำขอซ้ำที่ใช้ request key เดิมไม่สร้าง job ซ้ำ

มีข้อจำกัดชัดเจนเพื่อ pilot ไม่ใช่ระบบรองรับจำนวนครูไม่จำกัด ก่อนขยายต้องเพิ่ม worker/scheduler, capacity plan, spending caps ทั้งระบบ และ monitoring

## ความปลอดภัยและการเก็บรักษา

- Scanner เป็นการป้องกันเสริม ไม่ใช่เครื่องยืนยันว่าโค้ดปลอดภัย ขอบเขตหลักคือ origin แยก + iframe sandbox + CSP
- ปิด network, storage, popup, form submit, camera, microphone และการนำทางภายนอกของตัวเกม; wrapper ไม่รับโค้ดหรือข้อความจากเกมไป execute
- Browser check เป็น smoke test ไม่สามารถพิสูจน์ความถูกต้องของเกมหรือป้องกัน browser zero-day ได้ทั้งหมด ก่อนเปิดกว้างควรแยก worker สำหรับโค้ดไม่เชื่อถือออกจาก service ที่มี credential
- Chromium serverless ใช้ launch flags ที่เลือกเอง ไม่ใช้ default ของ package ที่ปิด web/site isolation และไม่ส่ง API/DB secret เข้า environment ของ browser process อย่างไรก็ตาม OS sandbox ของ Chromium serverless ไม่ได้เปิด (`--no-sandbox`) ซึ่งต่างจาก iframe sandbox ที่ยังเปิดอยู่ จึงต้องจำกัด pilot/เพิ่ม worker isolation ก่อนรับโค้ดจากผู้ใช้ทั่วไปจำนวนมาก
- token ในลิงก์เป็นสิทธิ์เข้าชม: ใครได้ลิงก์ก็เปิดได้ อย่าใส่ข้อมูลส่วนบุคคลในสื่อ Preview มีอายุ 15 นาที published ไม่มีวันหมดอายุจนกว่าจะปิดลิงก์
- การเพิกถอนมีผลกับการโหลดครั้งต่อไป ไม่สามารถเรียกคืนไฟล์ที่นักเรียนเปิด/คัดลอกไปแล้ว
- การเก็บเข้ากรุเป็น soft archive เก็บบทสนทนาและเวอร์ชันเดิมไว้ ยังไม่มี UI ลบถาวรหรือ retention/cleanup อัตโนมัติ
- ถ้า RPC finish ขาดการเชื่อมต่อหลัง commit ระบบไม่ลบ bundle ที่อาจบันทึกสำเร็จแล้ว อาจมี orphan private object ให้ผู้ดูแลตรวจทีหลัง ห้ามลบโดยไม่เทียบ `media_versions`
- ห้ามบันทึก auth header, API key หรือ share token ลง log; ไม่เก็บ secret ลง Git

## ทดสอบในเครื่อง

ใช้ working directory ที่มีโค้ดรุ่นนี้ (ระหว่างพัฒนา: `C:\Users\USER\ClassKru\_worktrees\media-studio-live`):

```powershell
npm.cmd ci --ignore-scripts
npm.cmd run test:media
npm.cmd run test:media:browser
```

ชุดทดสอบไม่ใช้ AI key และไม่เขียน Supabase Production: SQL ทดสอบบน PostgreSQL แยก, browser ทดสอบ HTTP สอง origin พร้อม AI fixture ครอบคลุม chat/build/resume/preview/publish/revoke/mobile และการบล็อก network/navigation/storage

ทดสอบกับ API จริง: สร้าง `.env.local` จาก `.env.example` ใส่ secret เฉพาะในเครื่อง พร้อมฐานข้อมูลที่ติดตั้ง migration แล้ว จากนั้น:

```powershell
npm.cmd run dev:media
```

เปิด `http://127.0.0.1:3511` (ClassKru) และตัวเปิดสื่อใช้ `http://127.0.0.1:3512` โดยอัตโนมัติ Windows ใช้ Chrome ที่ติดตั้งไว้ หรือกำหนด `MEDIA_BROWSER_EXECUTABLE` เอง **`python -m http.server` อย่างเดียวไม่สามารถรัน API สร้างสื่อจริงได้**

## ส่งขึ้น Git

ยึด workflow `CLAUDE.md`: feature branch → push → PR → ผู้ใช้ merge → Vercel auto-deploy ไม่ใช้ `vercel --prod` และไม่ deploy ไปทีม DOAI แทนโดยอัตโนมัติ การ push โค้ดอย่างเดียวไม่ติดตั้ง Supabase migration หรือสร้าง media project ให้
