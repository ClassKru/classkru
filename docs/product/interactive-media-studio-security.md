# Interactive Media Studio — แนวทางความปลอดภัยสำหรับสื่อที่ AI สร้าง

> สถานะ 20 ก.ย. 2569: implementation ปัจจุบันดู [คู่มือติดตั้ง](interactive-media-studio-setup.md) ใช้ไฟล์ JSON เข้ารหัสใน private bucket `classkru-media-files` ไม่สร้างตาราง media SQL เพิ่ม ส่วนแบบตารางด้านล่างเป็นประวัติ/roadmap ไม่ใช่วิธีติดตั้งปัจจุบัน ไม่มี public bucket/ไฟล์แนบ/Source Pack และยังไม่อ้างว่าทำมาตรการในเอกสารนี้ครบทุกข้อ
>
> ข้อควรระวังของแบบไฟล์: ต้องสำรอง `MEDIA_STORAGE_KEY`; encryption ไม่แทน Storage access control และไม่ป้องกันการลบ/replay journal โดยผู้มีสิทธิ์ ต้องตรวจ deny direct writes/delete ก่อนเปิดใช้ ไม่มี cleanup/rotation อัตโนมัติ ห้ามลบ lease/revoke history เอง รุ่นนี้จำกัด pilot จนกว่าจะผ่าน cloud permission/load tests และแยก worker รันโค้ดไม่เชื่อถือ
>
> เอกสารที่เกี่ยวข้อง: [แนวคิดผลิตภัณฑ์](interactive-media-studio.md) · [MVP spec](interactive-media-studio-mvp-spec.md)
>
> บันทึกเมื่อ: 19 กันยายน 2569

## การเชื่อม Preview ผ่าน Vercel Protection — เพิ่ม 20 ก.ย. 2569

ผู้ใช้อนุมัติ server-to-server Protection Bypass for Automation โดยคง Vercel Protection ไว้ ไม่เพิ่ม public domain exception โค้ด `media-host/api/render.js` อ่านเฉพาะ `CLASSKRU_APP_BYPASS_SECRET` ของโปรเจกต์หลักจาก server environment และส่งเป็น header ไปยัง HTTPS origin ที่ผู้ดูแลกำหนดใน `CLASSKRU_APP_ORIGIN` + fixed public-media endpoint ไม่รับ URL ปลายทางหรือ credentials จาก request ของผู้เล่น ไม่ตาม redirect ไม่ส่ง bypass cookie และไม่ส่ง secret เข้าเกม/เบราว์เซอร์

**Trust boundary ที่เพิ่ม:** media-host server ถือกุญแจผ่านด่าน Vercel ได้ทั้งโปรเจกต์หลัก ไม่ใช่กุญแจที่ Vercel จำกัดเฉพาะ API สื่อ จึงต้องจำกัดผู้เข้าถึง env, ไม่ตั้งใน Preview ที่ไม่เชื่อถือ, ไม่บันทึกลง log/URL/repository และ revoke เมื่อเลิกใช้หรือรั่ว ไม่ใช้ automatic `VERCEL_AUTOMATION_BYPASS_SECRET` ของ media project ซึ่งเป็นคนละกุญแจ ห้ามนำ AI/Supabase/Storage encryption key มาไว้ที่ media host

มาตรการเดิมยังอยู่: Supabase Auth/ownership บน API ครู, random share capability + review/revoke/hash บน public API และ sandbox/CSP ของเกม กุญแจอัตโนมัติที่ Vercel inject ให้ app server ต้องถูกกรองออกจาก environment ของ Chromium เช่นเดียวกับ secrets อื่น

ชุดทดสอบเพิ่มตรวจ fixed destination/header-only, ไม่ forward request cookies/headers, origin/config validation, native fetch ไม่ตาม redirect, generic errors/no credential reflection และไม่มี bypass secrets ใน Chromium environment **ยังไม่ใช่หลักฐานว่าได้ตั้งกุญแจหรือทดสอบ cloud จริงแล้ว** ขั้นตอนสร้าง/หมุน/เพิกถอนดู [คู่มือติดตั้ง ข้อ 3.1](interactive-media-studio-setup.md#31-เชื่อมเว็บสื่อกับ-preview-ที่มี-vercel-protection)

## 1. ขอบเขตที่เอกสารนี้ป้องกัน

เอกสารนี้ใช้กับโหมด **AI Custom Studio**: ครูหรือ AI สร้างสื่อเป็น web artifact ใหม่ เช่น HTML, CSS, JavaScript, รูปภาพ และเสียง แล้วเปิดให้ครูหรือนักเรียนใช้ผ่านเว็บ

ความเสี่ยงของโหมดนี้ต่างจาก template ปกติ เพราะไฟล์ที่สร้างขึ้นเป็นโค้ดที่ไม่น่าเชื่อถือ แม้ผู้สร้างตั้งใจดีหรือเป็น AI ของระบบเองก็ตาม. จึงต้องถือว่า artifact ทุกชิ้นเป็น `untrusted` จนผ่านขั้นเผยแพร่ และยังต้องอยู่ใน sandbox หลังเผยแพร่

เป้าหมายหลัก:

1. artifact ต้องไม่อ่าน session, localStorage, ข้อมูลห้องเรียน หรือข้อมูลครูจาก ClassKru หลัก
2. artifact ต้องไม่เรียก API ภายนอกหรือส่งข้อมูลออกเองโดยไม่ได้รับ capability ที่จำกัดไว้
3. artifact ต้องไม่ยกระดับสิทธิ์, นำผู้ใช้ออกจาก ClassKru, เปิด popup, ดาวน์โหลดไฟล์ หรือฝังเนื้อหาภายนอกเอง
4. draft, ประวัติสนทนา, Source Pack และไฟล์แนบต้องไม่กลายเป็นสาธารณะเพียงเพราะเผยแพร่สื่อรุ่นหนึ่ง
5. ครูต้องเพิกถอนสื่อที่เผยแพร่ได้ทันที และระบบต้องตามรอยได้ว่าสื่อรุ่นใดมาจากอะไร

เอกสารนี้ไม่ได้รับประกันว่าเกมที่ AI เขียนจะถูกต้องตามหลักวิชา ความเหมาะสมตามวัย หรือไม่มีข้อบกพร่องทั้งหมด; เรื่องเหล่านั้นยังต้องผ่าน quality review ของครูและ checklist ผลิตภัณฑ์

## 2. แบบจำลองภัยคุกคามและขอบเขตความเชื่อถือ

| สิ่งที่เข้ามาในระบบ | ระดับความเชื่อถือ | ความเสี่ยงที่ต้องรับมือ |
|---|---|---|
| ข้อความ/โค้ดจาก AI | ไม่เชื่อถือ | XSS, network exfiltration, loop หนัก, เนื้อหาหลอกลวง |
| ไฟล์ที่ครูแนบ | ไม่เชื่อถือ | malware, ชนิดไฟล์ปลอม, PII, ลิขสิทธิ์, zip bomb |
| artifact ที่ผ่าน publish | ยังไม่เชื่อถือ | ถูกแก้หรือมีช่องโหว่ที่ scanner ไม่พบ |
| ClassKru app, session ครู, Supabase credentials | เชื่อถือสูง | ต้องไม่ถูกส่งเข้า iframe หรือ bundle |
| Source Pack และประวัติสนทนา | ข้อมูลจำกัดสิทธิ์ | ต้องไม่ถูกติดไปกับ public media |
| ผู้เรียนผ่านลิงก์สาธารณะ | ไม่ยืนยันตัวตนโดยค่าเริ่มต้น | ต้องไม่เข้าถึงข้อมูลครู/ผู้เรียนอื่น หรือใช้งานเกินสิทธิ์ |

กติกาพื้นฐานคือ **การตรวจโค้ดเป็นเพียง defense in depth ไม่ใช่ trust boundary**. ขอบเขตจริงต้องมาจาก origin ที่แยก, iframe sandbox, Content Security Policy, capability ที่จำกัด และการตรวจสิทธิ์ที่ backend

## 3. โครงสร้างการเก็บและเผยแพร่

```text
AI / ครูแก้ไฟล์
      ↓
Staging artifact (private)
      ↓  validate + scan + bundle
Private version ใน Storage + metadata ใน Database
      ↓
Sandbox preview
      ↓  ครูยืนยัน review
Immutable published version
      ↓
Media host คนละ origin → iframe sandbox ใน ClassKru player
```

### 3.1 Database

Database เก็บเฉพาะ metadata, สิทธิ์ และประวัติที่ต้องค้นหาได้ เช่น:

- `media_projects` — เจ้าของ, สถานะ, classroom context ที่ไม่รวมรายชื่อนักเรียน
- `media_conversation_turns` — ข้อความที่ครูและ AI แลกเปลี่ยน, model metadata, สถานะ retention
- `media_versions` — ลำดับรุ่น, manifest, hash ของ bundle, สถานะ draft/published/revoked
- `media_assets` — metadata ไฟล์, MIME ที่ตรวจแล้ว, ขนาด, hash, owner และสถานะ scan
- `media_public_links` — token แบบเดายาก, version ที่ชี้, วันหมดอายุ/สถานะ revoke
- `media_security_events` — การ publish, revoke, scan fail, policy violation และการรายงานสื่อ

ตารางทุกชุดใช้ `teacher_id = auth.uid()` และ RLS แบบเจ้าของงาน. Backend เท่านั้นที่ใช้สิทธิ์ระดับ service สำหรับ scan, bundle และ promotion; browser ของครูหรือนักเรียนไม่เคยได้รับ service key

### 3.2 Storage

แยก bucket และ prefix เพื่อไม่ปน draft กับของที่เผยแพร่:

```text
media-staging/{teacherId}/{projectId}/{draftId}/...
media-private/{teacherId}/{projectId}/{versionId}/...
media-public/{publicId}/{versionId}/...
```

- ไฟล์ใน staging และ private เป็น private bucket ใช้ signed URL อายุสั้นเฉพาะ workflow ที่จำเป็น
- public artifact เป็นสำเนา immutable ที่สร้างหลัง publish เท่านั้น; ไม่คัดลอก Source Pack, ประวัติแชต, หรือ asset ที่ไม่มีสิทธิ์เผยแพร่
- ตรวจ MIME จากเนื้อไฟล์ ไม่เชื่อเพียงนามสกุล; จำกัดชนิดไฟล์, ขนาด, จำนวนไฟล์ และขนาดรวมต่อ project/version
- ไฟล์บีบอัดต้องแตกใน environment จำกัดทรัพยากรและมีเพดานจำนวนไฟล์/ขนาดที่แตกแล้ว

## 4. Artifact pipeline

AI หรือเบราว์เซอร์ไม่มีสิทธิ์เขียนเข้า `media-public` โดยตรง ทุกอย่างผ่าน backend pipeline ตามลำดับ:

1. **รับเข้า** — สร้าง staging version และบันทึกว่าไฟล์/คำสั่งใดสร้างจากครูหรือ AI
2. **ตรวจโครงสร้าง** — มี manifest, entry point เดียว, asset อยู่ใน allowlist และไม่มีไฟล์เกินนโยบาย
3. **วิเคราะห์ static** — ปฏิเสธหรือส่ง review เมื่อพบ `eval`, `new Function`, dynamic import ที่ควบคุมไม่ได้, remote script, `WebSocket`, `EventSource`, service worker, top-navigation, popup, form submission หรือ API browser ที่ไม่อนุญาต
4. **bundle** — externalize/normalize ไฟล์, lock dependency ที่ระบบอนุญาต, สร้าง content hash และ manifest ที่เปลี่ยนไม่ได้
5. **sandbox test** — เปิดใน browser worker ที่แยก, จำกัดเวลา และตรวจ console error, crash, navigation attempt, network attempt, viewport มือถือ/จอฉาย
6. **quality review** — แสดง security finding ร่วมกับ source/learning quality flags ให้ครูตรวจ
7. **promote** — เมื่อครูยืนยัน ระบบคัดลอก bundle ที่มี hash เดียวไปยัง public store และออก public token ใหม่

Scanner ไม่ควรพยายามอนุญาตทุกไวยากรณ์ JavaScript ตั้งแต่วันแรก. ถ้า artifact ใช้ feature ที่ scanner หรือ runtime ยังไม่เข้าใจ ต้องอยู่ใน draft หรือใช้ template/SDK ที่รองรับแทน

## 5. การแยก runtime ของสื่อ

### 5.1 Origin และ iframe

ห้ามเสิร์ฟ artifact ที่ AI สร้างภายใต้ origin เดียวกับแอปครู เช่น ห้ามให้มันรันภายใต้ `classkru.../app/...` พร้อม session เดียวกัน

ต้องมี media host แยก เช่น `media.classkru.example` หรือ origin ที่ให้สิทธิ์เทียบเท่า และ player หลักฝังผ่าน iframe โดยค่าเริ่มต้น:

```html
<iframe
  sandbox="allow-scripts"
  referrerpolicy="no-referrer"
  src="https://media.classkru.example/p/{public-token}">
</iframe>
```

ไม่เพิ่ม `allow-same-origin`, `allow-top-navigation`, `allow-popups`, `allow-downloads`, `allow-modals` หรือ `allow-forms` จนกว่าจะมี use case ที่ผ่าน review เฉพาะรายการ. การตัด `allow-same-origin` ทำให้ JavaScript ในสื่อไม่มีสิทธิ์เป็น origin เดียวกับ host แม้ไฟล์จะถูกเสิร์ฟจากโดเมน media

### 5.2 Content Security Policy

media host ต้องส่ง CSP ที่ deny by default และเพิ่มเฉพาะความสามารถจำเป็น ตัวอย่างเป้าหมาย:

```text
default-src 'none'
script-src 'self'
style-src 'self'
img-src 'self' data: blob:
media-src 'self' blob:
connect-src 'none'
font-src 'self'
base-uri 'none'
form-action 'none'
frame-ancestors https://app.classkru.example
```

การตั้งค่าจริงต้องทดสอบกับ bundler และ storage host ก่อนใช้. หากภายหลังอนุญาต API เช่น การบันทึกผลรวม ต้องเปิด `connect-src` ไปยัง endpoint เดียวที่ออกแบบสำหรับ capability นั้น ไม่เปิดไปทุกโดเมนหรือ Supabase ทั่วไป

### 5.3 การสื่อสารกับแอปหลัก

artifact ไม่มีสิทธิ์เรียก API ของ ClassKru เอง. ถ้าต้องการความสามารถ เช่น `restart`, `reportComplete` หรือ `requestStageMode` ให้ใช้ Media SDK แบบ capability-based:

1. player สร้าง nonce เฉพาะ instance และเปิด `MessageChannel` ให้ iframe หลัง load
2. iframe ต้องส่ง nonce กลับมา และ player รับข้อความเฉพาะจาก `frame.contentWindow` ที่มี nonce ถูกต้อง
3. SDK เปิดเฉพาะ method ที่ manifest ขอและ policy อนุญาต
4. payload ทุกครั้งต้องผ่าน schema และ rate limit; ไม่มี method ทั่วไปสำหรับ query ห้องเรียน, รายชื่อนักเรียน, access token หรือ fetch arbitrary URL

การใช้ sandbox ที่มี opaque originอาจทำให้ต้องใช้ `postMessage` แบบไม่ผูก origin ในขั้น handshake; nonce ที่เดาไม่ได้, การตรวจ source window และ MessageChannel ที่เป็น private channel จึงเป็นสิ่งบังคับ ไม่ใช่ทางเลือก

## 6. ข้อมูลส่วนบุคคล, AI และ Source Pack

- Context เริ่มต้นที่ส่งให้ AI ใช้วิชา, ระดับชั้น, เวลา, อุปกรณ์ และตัวชี้วัด; ไม่ส่งรายชื่อ, รหัสนักเรียน, คะแนน, การเข้าเรียน หรือข้อความนักเรียนโดยอัตโนมัติ
- ต้องมีหน้า consent/notice อธิบายว่าข้อความและไฟล์ใดจะถูกส่งไปยังผู้ให้บริการ AI, ใช้เพื่ออะไร, และเก็บไว้นานเท่าใด
- Source Pack และประวัติสนทนาเป็น private โดยค่าเริ่มต้น และไม่ถูกส่งตาม public token
- ก่อนส่งไฟล์ให้ AI ให้เตือน/ตรวจสัญญาณ PII เบื้องต้น; ครูเป็นผู้ยืนยันว่าได้รับสิทธิ์ใช้ไฟล์และสิทธิ์ส่งต่อให้ผู้ประมวลผลแล้ว
- ไม่ใช้ไฟล์หรือบทสนทนาของครูเพื่อฝึกโมเดล เว้นแต่ครูให้ความยินยอมแยกและมีนโยบายที่สื่อสารชัดเจน

## 7. สิทธิ์การเผยแพร่และการเพิกถอน

ค่าเริ่มต้นของทุก project คือ private draft. การกด publish ต้องเป็นการกระทำชัดเจนของครูและสร้าง version immutable

ตัวเลือกของลิงก์เผยแพร่ที่ควรออกแบบ:

| รูปแบบ | การใช้ที่เหมาะสม | ข้อกำหนดขั้นต่ำ |
|---|---|---|
| private preview | ครูตรวจงาน | authenticated + signed URL อายุสั้น |
| unlisted link | ใช้ในชั้นเรียนผ่าน QR | token เดายาก, revoke ได้, ไม่แสดงใน search |
| class-restricted | ต้องระบุตัวผู้เข้าร่วม | auth/participation policy ที่ออกแบบแยก |
| public share | ครูต้องการเผยแพร่ | review การใช้ asset, report/kill switch, นโยบายเนื้อหา |

การ revoke ต้องหยุดเสิร์ฟ manifest ของ public version และปิด asset URLs ที่เกี่ยวข้องในระดับ application ทันที. CDN cache ต้องใช้ versioned immutable path และ public manifest ที่ตรวจสิทธิ์ได้ เพื่อไม่ให้การแก้ไฟล์เดิมย้อนกลับไปเปลี่ยนสื่อเก่าหรือทำให้ revoke ไม่ทำงาน

## 8. การใช้ทรัพยากรและการเฝ้าระวัง

- กำหนด quota ต่อครู/project: จำนวน generation, ขนาด bundle, จำนวน asset, ระยะเวลา preview และจำนวน public versions
- browser test ใช้ timeout และแยก process; ถ้า artifact loop หรือใช้ CPU ผิดปกติให้หยุดงานและคืนผล “ต้องแก้” ไม่ retry ไม่สิ้นสุด
- จำกัด event จาก Media SDK และ QR run ในอนาคตด้วย schema, payload size และ rate limit
- เก็บ audit log ของ generate, upload, publish, revoke, policy violation และการเข้าถึงแบบสรุปตามความจำเป็น
- มีปุ่ม report สื่อและ kill switch ระดับ version/project สำหรับผู้ดูแลเมื่อพบ phishing, เนื้อหาอันตราย หรือการละเมิดนโยบาย

## 9. Quality gate ด้านความปลอดภัยก่อน publish

สิ่งต่อไปนี้เป็น blocker ในรอบแรก:

1. bundle/manifest ไม่ผ่าน validation หรือ hash ไม่ตรงกับผล scan
2. มี network call, remote code, browser privilege หรือ sandbox permission ที่ policy ไม่อนุญาต
3. preview ไม่ผ่านบน 390×844 หรือ 1280×720, มี crash/console error ร้ายแรง หรือพยายาม navigation
4. มี Source Pack/asset ที่สถานะสิทธิ์ไม่ชัดเจนใน public bundle
5. มี security finding ที่ยังไม่ได้รับการแก้หรืออนุมัติโดยผู้มีสิทธิ์ตามระดับความเสี่ยง

การแจ้งเตือนที่ไม่ควร block แต่ต้องให้ครูเห็น เช่น อ่านยาก, ใช้สีใกล้กัน, เวลายาวเกิน หรือข้อเท็จจริงที่ยังต้องตรวจทาน อยู่ใน quality report แยกจาก security gate

## 10. คำถามที่ต้องตัดสินใจก่อนเริ่มพัฒนา

1. จะใช้ media host เป็นโดเมนแยกใด และใครมีสิทธิ์กำหนด CSP/headers ของ host
2. artifact อนุญาต dependency ภายนอกแบบใดบ้าง หรือรอบแรกให้ใช้ platform SDK/standard browser APIs เท่านั้น
3. จะใช้ scanner/bundler ใด, รันที่ใด, และมีข้อจำกัด CPU/memory/time เท่าใด
4. สื่อ public อนุญาตชนิดไฟล์ใด, เก็บได้นานเท่าใด และครูยืนยันสิทธิ์ใช้ asset อย่างไร
5. ผู้ให้บริการ AI เก็บ request/response อย่างไร และครูลบประวัติหรือขอ export ข้อมูลได้หรือไม่
6. kill switch, การรายงาน และ SLA การตอบสนองเมื่อพบสื่อไม่ปลอดภัยเป็นของใคร

จนกว่าคำตอบเหล่านี้จะชัดเจน ไม่ควรเปิด AI Custom Studio ให้สร้างและเผยแพร่ JavaScript อิสระ แม้จะเปิดให้สร้าง draft สำหรับการทดลองภายในได้ก็ตาม
