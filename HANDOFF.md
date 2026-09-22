# HANDOFF — บริบทสำหรับสานต่องาน ClassKru

> อัปเดตล่าสุด: 22 กันยายน 2569
>
> **งานที่กำลังส่งขึ้นเว็บหลัก: AI Interactive Media Studio — Storage-only JSON** บน `feature/media-studio-live`, workspace `C:\Users\USER\ClassKru\_worktrees\media-studio-live` เท่านั้น ห้าม push ต้นแบบ/งานอื่นที่ค้างในโฟลเดอร์หลักทับ branch นี้
>
> **22 ก.ย. 2569 — Initial / Empty State:** ปรับหน้าเริ่มต้นของ “สร้างสื่อการสอนกับ AI” ให้เป็น AI Thinking Partner: hero, ตัวเลือกสื่อเพียง `สื่อภาพ / สื่อเคลื่อนไหว / เกม`, idea starters 4 แบบ, composer ที่อธิบายว่าพิมพ์ไอเดียคร่าว ๆ ได้ และแผง “AI จะช่วยคุณ” โดยไม่แสดงบทสนทนาเก่าใน initial state. เลือก/ยกเลิกประเภทสื่อได้แต่ไม่บังคับก่อนส่ง; `media_type` (`image|motion|game`) ส่งเข้า Planner เป็น context แบบ backward-compatible และ server validate ค่า. ส่งข้อความแรกแล้วเปลี่ยนเป็น chat/“สิ่งที่เรารู้ตอนนี้” พร้อม animation เบา ๆ; เปิด history จากปุ่มเมื่อครูต้องการเท่านั้น. ไม่มี upload ใน flow เดิม จึงแสดงปุ่มแนบไฟล์ disabled ว่าเร็ว ๆ นี้ ไม่หลอกว่าส่งไฟล์ได้. เพิ่ม browser regression สำหรับ initial/selection/starter/send-without-type/transition/error/resume และตรวจ 1440×900, 390×844; `npm.cmd run test:media`, `npm.cmd run test:media:browser`, syntax และ navigation regression ผ่าน. Asset version `488`.
>
> **22 ก.ย. 2569 — push เข้า main แล้ว:** รวม `origin/main` ถึง `d73ee5a` เข้า branch นี้แล้ว โดยรับการเปลี่ยนแปลงจาก main ครบและคง asset `488`; Media tests 21/21, browser QA, navigation และ quiz generation ผ่าน. Push แบบ fast-forward เข้า `main` สำเร็จที่ `ebed1f6`; Vercel ควร deploy ตาม workflow อัตโนมัติ แต่ยังไม่ได้ตรวจ deployment หรือทดสอบ AI/Supabase Storage ด้วยบัญชีครูจริง. `tests/worksheet-layout.test.cjs` มี 1 ข้อที่รันไม่ได้เพราะเครื่องไม่มี executable `unzip` (`spawnSync unzip ENOENT`) ไม่ใช่ assertion/regression ของงานนี้.
>
> **21 ก.ย. 2569 — ปรับเป็นช่วงสนทนาก่อนสร้างสื่อ:** เข้าได้จากการ์ดเดียวในหน้าเครื่องมือ “คุยออกแบบสื่อกับ AI” โดยไม่รับหรือบันทึกความผูกกับห้องเรียน; API `create` ทิ้ง `context` จาก client และเก็บ conversation เป็น teacher-owned project เดิมในไฟล์ JSON เข้ารหัส. หน้าต่างเหลือสามส่วน: การ์ดบทสนทนาเก่าด้านซ้าย, แชตที่ enqueue/run และดึงคำตอบ AI กลับมาอัตโนมัติตรงกลาง, และแนวทาง/คำถามต่อยอดจาก AI ด้านขวา. ตัดข้อความตัวอย่างและส่วน preview/publish ออกจาก UI; ปุ่ม “สร้างสื่อ · เร็ว ๆ นี้” disabled ไว้ชัดเจน. API สร้าง artifact เดิมยังคงอยู่เพื่อช่วงถัดไป แต่ UI รอบนี้ส่งเฉพาะ `plan`. เพิ่ม regression ยืนยัน API ไม่ยอมผูก context ห้องเรียน และ Browser QA สำหรับแชต/ตอบอัตโนมัติ/กลับมาเปิดบทสนทนา/มือถือ; `npm.cmd run test:media` ผ่าน 21 ข้อและ `npm.cmd run test:media:browser` ผ่าน. Bump asset เป็น `487`.
>
> 21 ก.ย. 2569: rebased งานสนทนาเข้ากับ `origin/main` แล้วและตรวจซ้ำผ่านทั้ง API 21 ข้อกับ Browser QA. กำลังส่ง fast-forward ไป `main` เพื่อให้ Vercel deploy Production; ยังไม่ได้ทดสอบแชตจริงกับบัญชีครู, Supabase Storage และ OpenRouter runtime.
>
> ผู้ใช้ขอเก็บใน Supabase เดิมแต่ไม่เพิ่มตาราง SQL จึงเปลี่ยน jobs/turns/plans/versions/links/quotas เป็นไฟล์ JSON เข้ารหัส AES-256-GCM ใน private bucket `classkru-media-files` สร้าง bucket อัตโนมัติเมื่อสร้างงานแรก ใช้ Auth/OpenRouter เดิม ไม่แตะข้อมูลเช็กชื่อ/คะแนน
>
> ต้องตั้ง `MEDIA_STORAGE_KEY` เป็น random 32 bytes hex (64 ตัว) และสำรองอย่างปลอดภัย เพิ่มจาก Supabase server key/AI/origin ที่ต้องตั้งอยู่แล้ว ทุก instance ที่ใช้ bucket เดียวต้องใช้ key เดียว ห้ามสุ่มเปลี่ยน key หลังมีงาน; ยังไม่มี rotation/migration tool
>
> ทุก write สร้างไฟล์ใหม่ exclusive upload ไม่ overwrite/delete; leases เป็น append-only sequence + release marker กัน stale release, สูงสุด 2 workers ทั้งระบบ/ครูละ 1, 3 pending, 40 คำขอต่อวันปฏิทินไทย, 100 projects, 30 versions, preview/published link ชนิดละ 200 ต่องาน มี immutable claim ไม่ retry AI ซ้ำโดยอัตโนมัติ ผลลัพธ์+คำตอบ AI commit ใน JSON ไฟล์เดียว; orphan files ไม่ถูกลบทิ้ง
>
> สคริปต์ SQL รุ่นเก่าย้ายไป `docs/product/history/202609190001_media_studio.sql` เป็นประวัติ ไม่ต้องรัน ไม่ได้ลบตาราง/bucket จริง ถ้าเคยใช้ SQL pilot มีงานแล้ว ต้องสำรวจและวางแผนโอนก่อนสลับ (รุ่นใหม่ไม่ย้ายงาน SQL อัตโนมัติ)
>
> **ยังไม่เปิด Media Studio บนเว็บหลัก Production:** ผู้ใช้สร้าง media Vercel project แล้ว (รายละเอียดด้านล่าง); ยังต้องจับคู่ origins, ตรวจ server env/Storage policies โดยเฉพาะ direct write/delete ที่ encryption ป้องกันไม่ได้ และทดสอบ AI/Auth จริง เครื่องนี้ CLI เข้าถึงแค่ DOAI ไม่ใช่ `classkru-dev`; ไม่ deploy ข้ามทีมแทน
>
> **20 ก.ย. 2569 — เว็บเปิดสื่อ Deploy ผ่านแล้ว:** โปรเจกต์ `classkru-media` ในทีม `classkru-dev` ใช้ repo `ClassKru/classkru`, branch `feature/media-studio-live`, commit `d91cd65`, Root Directory `media-host`; deployment `DjQ2eCa2N8mhmUMaYjmwNHtyZFcU` success ตรวจ URL `https://classkru-media.vercel.app/` แบบไม่ล็อกอินได้ HTTP 200, title `สื่อการสอน · ClassKru` และมี `player.js`/`player.css` แล้ว ไม่ใช่หน้า login ซ้ำเดิม สาเหตุ error ก่อนหน้าคือช่องว่างนำหน้า Root Directory (`" media-host"`) ซึ่งผู้ใช้แก้แล้ว ไม่ใช่ Git ผิด repo ผู้ใช้ตรวจยืนยันการเชื่อมต่อมาจาก ClassKru
>
> **Cloud env ที่ผู้ใช้รายงานว่าตั้งแล้ว (ยังไม่ตรวจค่าลับจริง):** โปรเจกต์หลัก `classkru` / Preview branch `feature/media-studio-live` มี `OPENROUTER_API_KEY`, `MEDIA_STORAGE_KEY`, `MEDIA_STORAGE_BUCKET=classkru-media-preview`; เดิมมี `SUPABASE_SECRET_KEY` ทั้ง Production/Preview ส่วนโปรเจกต์ `classkru-media` / Production ตั้ง `CLASSKRU_APP_ORIGIN=https://classkru-git-feature-media-studio-live-classkru-dev.vercel.app` ตามขั้นตอน ไม่ใส่ AI/Supabase/encryption secrets บน media host
>
> **MEDIA_ORIGIN:** ผู้ใช้รายงานว่าตั้ง `MEDIA_ORIGIN=https://classkru-media.vercel.app` ในโปรเจกต์หลักเฉพาะ Preview branch นี้และทำตามขั้นตอน redeploy เรียบร้อยแล้ว ยังไม่ได้ตรวจ runtime env โดยตรงเพราะ app Preview ตอบ 302 ไป `vercel.com`
>
> **ผู้ใช้อนุมัติ "เชื่อมต่อเลย" — เพิ่ม server-only automation bypass:** `media-host/api/render.js` รองรับ `CLASSKRU_APP_BYPASS_SECRET` (ต้องสร้างจากโปรเจกต์ `classkru` แล้วตั้ง Type Secret / Production ใน `classkru-media`) ส่ง header เฉพาะ fixed API บน HTTPS `CLASSKRU_APP_ORIGIN`, ไม่มี query/cookie/forward ผู้ใช้/redirect, ไม่ใช้ automatic secret ของ media project, fail closed บน config ไม่ปลอดภัยหรือ upstream สะท้อน secret กุญแจมีขอบเขตผ่าน Vercel ทั้งโปรเจกต์จึงบันทึก threat model และการ revoke ไว้แล้ว ไม่ปิด Protection/ไม่เปิด public domain exception
>
> **ผลตรวจ bypass ในเครื่อง:** `npm run test:media` **21 tests ผ่าน** (เดิม 14 + media-host 7 รวม native fetch redirect และ credential leakage); Chromium environment ไม่รับทั้ง bypass secret สองชื่อ; Browser chat/build/resume/preview/review/publish/revoke/mobile/sandbox/network/navigation ผ่าน ไม่เปลี่ยน frontend js/css จึงไม่ต้อง bump asset 485
>
> **ส่งขึ้น Git และ Deploy bypass แล้ว:** commit `093c11b` บน `feature/media-studio-live` / PR #75 ผ่าน CI run `35498260707`, Vercel `classkru-media` deployment `FUraJNt3xwFr5ubFUrsgdbHYpSWc` และ `classkru` deployment `A8p1bASmKrqe4Xt7K3Ds74382A4P` success ทั้งคู่ ไม่มีการ merge main
>
> **21 ก.ย. 2569 — ผู้ใช้ตั้ง bypass secret และ redeploy แล้ว:** Vercel `classkru-media` deployment `9LHcwgYvp79oCmieboZMZbmR68b5` success ทดสอบภายนอกแบบไม่ใช้/ไม่แสดง secret ด้วย `GET https://classkru-media.vercel.app/api/render?token=<64hexจำลอง>` + `sec-fetch-dest: iframe` ได้ HTTP **404** และข้อความ generic (ไม่ redirect/ไม่ใช่ 503) ซึ่งยืนยันว่า media host ผ่าน Vercel Protection ไปถึง public API ของ `classkru` แล้ว แต่ token ไม่มีอยู่จริงจึงถูกปฏิเสธตามออกแบบ
>
> **ขั้นถัดไป:** ครูล็อกอิน ClassKru Preview แล้วทดสอบสร้างสื่อจริงผ่าน AI → review → publish → เปิดลิงก์จากหน้าต่างส่วนตัว/มือถือ ตรวจว่า link เปิดจริงและ revoke แล้วเป็น 404; จากนั้นตรวจ Supabase Storage policies สองบัญชี/AI usage ก่อน merge PR ยังไม่ได้ทดสอบ AI/Storage cloud หรือมีสื่อ/link จริง ไม่ถือว่าเปิด Production
>
> ผลทดสอบในเครื่อง: Media unit/integration **14 tests ผ่าน**, Browser chat/build/resume/preview/review/publish/revoke/mobile + sandbox/network/navigation ผ่าน, Word export/lesson/worksheet **10 tests ผ่าน**, syntax **97 JS/CJS files ผ่าน**, npm audit **0 vulnerabilities** ไม่ใช่การทดสอบ Supabase/AI Production; asset **485** ผ่าน `bump-version.sh`
>
> **Storage-only commit `6b2c4cb` push แล้วและผ่าน CI + Vercel Preview จริง**: GitHub Actions run `35481707707` success, Vercel deployment `By1kUEwoDerDd5VJBcTWJxeaZPf5` success; PR #75 ยังเปิด/mergeable และอัปเดตคำอธิบายเป็นวิธีติดตั้งแบบไม่รัน SQL แล้ว จำนวน functions ยัง **11/12** ผลนี้ยืนยัน build/test ไม่ใช่การตั้งค่า cloud/AI หรือ production E2E
>
> [Preview](https://classkru-git-feature-media-studio-live-classkru-dev.vercel.app) ยังมี Deployment Protection (302 เมื่อไม่ล็อกอิน) ยังไม่ merge PR คู่มือตั้งค่า/ข้อจำกัด/โครงสร้างไฟล์: [interactive-media-studio-setup.md](docs/product/interactive-media-studio-setup.md)
>
> สำหรับงานนี้ยึด `CLAUDE.md`: feature → PR → ผู้ใช้ merge → Vercel auto-deploy ไม่ใช้ workflow push `HEAD:main` เก่าด้านล่าง; ไม่มี scheduler อิสระ ต้องเปิดงานเพื่อเริ่ม queued; polling ตรวจสถานะทุก 5 วินาที ไม่โหลดประวัติเต็มซ้ำขณะสถานะคงเดิม
>
> เวอร์ชันล่าสุด: เพิ่มพื้นฐานระบบสมาชิก/การชำระเงินแบบโหมดทดสอบ, หน้าสมาชิกในแอป, แท็บสมาชิกสำหรับผู้ดูแล และรายงานการขายเงินแบบอ่านอย่างเดียว; migration `202609170001_membership_billing_foundation.sql` รันบน Supabase Production สำเร็จแล้ว; commits `4e8c129`, `e16ca4f`, `ba93ff2` push ขึ้น `main` แล้วเพื่อให้ Vercel deploy; asset version `463`
>
> เวอร์ชัน 460: คลังสื่อการสอนเอากล่องข้อความแจ้งการเชื่อมห้องเรียนออกจากหน้าสร้างข้อสอบ เพราะข้อมูลซ้ำกับช่องเลือกห้องเรียน; การเชื่อม `classId` ยังทำงานเหมือนเดิม
>
> เวอร์ชัน 459: คลังสื่อการสอนเอาตัวเลือก “รูปแบบการใช้งาน” ออกจากหน้าสร้างข้อสอบ ลดความสับสน และกำหนดข้อสอบใหม่เป็นแบบทดสอบอัตโนมัติ; คงข้อสอบเก่าไว้ตามข้อมูลเดิม
>
> เวอร์ชัน 458: คลังสื่อการสอนเพิ่มการปิด modal แก้ไขรายละเอียดข้อสอบด้วยปุ่ม Escape และคลิกพื้นที่ฉากหลัง เพื่อให้ใช้งานคีย์บอร์ดและหน้าจอเล็กได้ต่อเนื่องขึ้น; ตรวจ syntax JS ทั้งชุดและ navigation/guide regression ผ่าน
>
> เวอร์ชัน 428: เพิ่มตารางกรอกผลประเมินเพิ่มเติมแยกจากรายงาน ให้แก้รายคน/รายช่องได้ พร้อมกรอกเร็วหลายคนแบบทั้งห้อง/เฉพาะช่องว่าง; เอกสารรายงานและไฟล์พิมพ์ไม่มี footer ข้อความ ClassKru
> เวอร์ชัน 427: ถอยตาราง ปพ.5 “ผลประเมินเพิ่มเติม/คุณลักษณะฯ” กลับเป็นรายงานผลแบบ plain table ตามรูปแบบเดิม ไม่มี select/input ในตัวกระดาษ; แผงกรอกเร็วหลายคนอยู่ด้านบนแยกจากรายงาน
>
> เวอร์ชัน 426: ปรับหน้า ปพ.5 ผลประเมินเพิ่มเติมให้ช่องที่แก้ได้ดูเป็น input/select ชัดเจน เพิ่มแถบกรอกเร็วในหน้าเอกสาร และเพิ่มโหมดกรอกหลายคนแบบทั้งห้อง/เฉพาะช่องว่าง
>
> เวอร์ชัน 425: ปรับ ปพ.5 ให้ผลสรุปคุณลักษณะอันพึงประสงค์คำนวณจาก 8 คุณลักษณะตามแนวทาง สพฐ. ไม่ให้กรอกช่องสรุปแยกเองจนขัดกับรายข้อ; ถ้ารายข้อยังไม่ครบจะแสดงว่ายังไม่สรุป
>
> เวอร์ชัน 424: บันทึกผลประเมิน ปพ.5 อัตโนมัติเมื่อครูเปลี่ยนผลในหน้าเอกสาร และ flush ค่าล่าสุดก่อนสลับไปหน้าสรุป/พิมพ์/ส่งออก
>
> เวอร์ชัน 421: หน้าค้นหาเพิ่มตัวชี้วัดใช้ปุ่มเลือกกลุ่มสาระชุดเดียวกับคลัง และแสดงระดับชั้น/หน่วย/มาตรฐาน/ค้นหาทันที ขยาย modal เป็น 1120px และเลื่อนทั้งแผงบนมือถือได้
>
> เวอร์ชัน 420: ย่อเฉพาะตัวชี้วัดเป็นรหัส ชิ้นงานในกิ่งซ้ายแสดงชื่อเต็มและขึ้นบรรทัดใหม่ได้ตามคำชี้แจงล่าสุด
>
> เวอร์ชัน 419: บล็อกตัวชี้วัดแสดงเฉพาะรหัส กดรหัสเปิด editor เดิม ลากด้วยจุดจับ กิ่งงานเรียงลงจากขอบซ้ายและมีเส้นแยกไปยังตัวย่อแต่ละงาน รายละเอียด/คะแนนเต็มยังอยู่ใน editor
>
> ตัวชี้วัดรายวิชา: ปรับกระดานสองฝั่งให้พื้นหลังเรียบ มีแถบหัวข้อก่อน/หลังกลางภาค บล็อกลากได้โดยเว้นพื้นที่หัวข้อ 80px และกิ่งตัวย่อแนวตั้งไม่พาดทับข้อความ ตำแหน่งใหม่จัดกึ่งกลางแต่ละฝั่งตามขนาดกระดาน ใช้ asset version 418; ตรวจ syntax และ QR/relational regression ผ่าน
>
> **คำสั่งเริ่มงานในแชทใหม่: `สานต่อ`**
>
> เมื่อได้รับคำนี้ ให้อ่าน `VISION.md` → `CLAUDE.md` → ไฟล์นี้ จากนั้นตรวจ Git แล้วทำงานต่อจากสถานะจริงทันที

---

## 1. เป้าหมายและวิธีคิดร่วมกับผู้ใช้

ClassKru เป็นผู้ช่วยครูไทยที่เน้นลดภาระงานซ้ำ ใช้ง่าย สบายตา บันทึกปลอดภัย และอยู่ในจังหวะการสอนจริง ไม่ใช่เพียงโปรแกรมกรอกคะแนนหลังเลิกสอน

หลักตัดสินใจสำคัญ:

- อ่านและยึด `VISION.md` ก่อนเสนอหรือออกแบบฟีเจอร์
- ความเรียบง่ายและการลดจำนวนขั้นตอนสำคัญกว่าการมีฟีเจอร์จำนวนมาก
- ใช้ข้อมูลจริงที่มีอยู่แล้ว ไม่สร้าง schema หรือข้อมูลซ้ำโดยไม่จำเป็น
- งานหนึ่งครั้งควรสร้างผลลัพธ์ต่อยอดได้หลายครั้ง
- UI ต้องรองรับมือถือ เพราะครูใช้กล้องและทำงานระหว่างสอน
- สนทนากับผู้ใช้เป็นภาษาไทย ในฐานะผู้ช่วยคิดทั้งผลิตภัณฑ์ ธุรกิจ และการตลาด
- แนวคิดธุรกิจเพิ่มเติมอยู่ใน `BUSINESS_STRATEGY.md` ซึ่งอาจยังเป็นไฟล์นอก Git ให้เก็บรักษาไว้และห้ามลบ

---

## 2. สถานะ Repository และ Production ปัจจุบัน

- Repository: `https://github.com/ClassKru/classkru.git`
- Production: `https://classkru-kohl.vercel.app/`
- Branch ทำงาน: `main`
- QR feature baseline: commit `fa6c1ca`
- ค่า `HEAD`, `main` และ remote อาจมี documentation commit หลัง baseline นี้ ให้ตรวจจาก Git ทุกครั้งและไม่ยึดเลข commit ในไฟล์นี้เป็นหลัก
- Asset version ปัจจุบันบน `feature/media-studio-live`: `488`
- งานล่าสุด: **ปพ.5** สรุปคุณลักษณะอันพึงประสงค์จากคะแนนรายข้อ 8 คุณลักษณะตามเกณฑ์ `ดีเยี่ยม / ดี / ผ่าน / ไม่ผ่าน`, ใช้ช่องสรุปเป็นผลคำนวณในเอกสารและ Excel, และยังให้ครูกรอกผลอ่าน คิดวิเคราะห์ และเขียนแยกตามแบบเดิม
- งานล่าสุด: คลังตัวชี้วัด ม.1-ม.3 เปิดใช้ครบ 8 กลุ่มสาระ รวม 688 ตัวชี้วัด (ภาษาไทย 103, คณิตศาสตร์ 33, วิทยาศาสตร์ 174, สังคมศึกษา 140, สุขศึกษา 72, ศิลปะ 86, การงานอาชีพ 18 และภาษาต่างประเทศ 62) พร้อมตัวตรวจจำนวน รหัสซ้ำ ความสัมพันธ์มาตรฐาน/หัวข้อ และการค้นหาผ่าน catalog
- งานล่าสุด: แผนภาพ **ตัวชี้วัดรายวิชา** แสดงคะแนนเต็มสำหรับ ปพ.5 และแต่ละกิ่งงานแสดงคะแนนเต็มดิบ น้ำหนักแบบทศนิยมที่รวมได้ 100% พร้อมคะแนนที่คิดเป็นจากคะแนนเต็มตัวชี้วัด เพื่อลดความสับสนระหว่างสองสเกลคะแนน
- งานล่าสุด: เมนู Desktop/Mobile ใช้ `APP_NAVIGATION` ชุดเดียว, Sidebar desktop เป็น rail 80px และขยายเมื่อ hover/focus; Production version 393 ตรวจ HTML mount points, JS renderer และ CSS rail markers แล้ว
- Cloud canonical state เป็น 8 ตาราง SQL, เขียนรายแถว/รายคอลัมน์, soft delete, RLS ตาม `teacher_id` และคง JSON เดิมไว้สำหรับ fallback/rollback ช่วงเปลี่ยนผ่าน
- Supabase Production ใช้ migration ครบถึง `202608260002`; ตรวจ ACL allowlist, JSON เดิม 12 แถว และ smoke test แบบ rollback ผ่านแล้ว
- งานไกด์ล่าสุด: ต่อระบบไกด์/ทัวร์ในแอป ให้เปิดจากศูนย์ช่วยเหลือได้หลายหมวด และมีไกด์แบบพาทำสำหรับสร้างห้อง เพิ่มนักเรียน เพิ่มคาบสอน เช็คชื่อ คะแนน รายงาน เครื่องมือ และเกม
- Vercel Deploy จาก `main` โดยอัตโนมัติ
- ไฟล์ `BUSINESS_STRATEGY.md` เป็นงานของผู้ใช้ที่ยัง untracked ณ เวลาบันทึก ห้ามลบ แก้ หรือรวม commit โดยไม่ตรวจสอบขอบเขตงาน

ก่อนเริ่มงานทุกครั้ง ให้ตรวจหลักฐานจริง:

```powershell
git status --short
git log -8 --oneline --decorate
git remote -v
```

หาก commit หรือ version เปลี่ยนไป ให้ถือ Git/Production ล่าสุดเป็นจริงและอัปเดตหัวข้อนี้

---

## 3. Feature ล่าสุด — ตรวจงานและลงคะแนนด้วย QR

ไฟล์หลัก:

- `js/qr-scores.js` — state, chained selection, camera, scan, validation, save และ UI update
- `css/12-qr-scores.css` — modal/scanner/score input/responsive
- `index.html` — เมนู desktop/mobile และ QR modal
- `student-qr-cards.html` — พิมพ์บัตร QR นักเรียน
- `js/vendor/html5-qrcode.min.js` — scanner library แบบ local
- `js/vendor/qrcode.min.js` — QR generator แบบ local
- `tests/qr-scores.test.cjs` — test หลักของ feature
- `tests/cloud-write-queue.test.cjs` — ป้องกัน cloud write เก่าเขียนทับคะแนนใหม่
- `guide-qr.html` — คู่มือ QR
- `vercel.json` — `Permissions-Policy: camera=(self)` สำหรับ Production

พฤติกรรมที่ทำเสร็จแล้ว:

1. เมนู **ตรวจงานด้วย QR** แสดงทั้ง Sidebar desktop และ Bottom Navigation มือถือ
2. ตัวเลือกใช้ข้อมูลจริงตามลำดับ `ปีการศึกษา → ระดับชั้น → ห้องเรียน → วิชา → งาน`
3. ช่องถัดไปล็อกจนเลือกช่องก่อนหน้า แต่ไม่มีข้อความ “เลือก...ก่อน” เพราะมีเลขลำดับนำสายตาแล้ว
4. งานและคะแนนเต็มดึงจาก `appState.classes[].scores.items` ซึ่งซิงก์กับ Supabase
5. หาก Cloud เพิ่งโหลดหลังเปิด modal รายการจะ refresh โดยไม่ทับตัวเลือกที่ครูเริ่มเลือกแล้ว
6. ช่องตั้งค่าคะแนนแสดง `___/10`; เลขหน้าเป็น input แก้ไขได้หลังเลือกงาน ส่วน `/10` ดึงจากคะแนนเต็มของงาน
7. คะแนนที่กรอกในหน้าตั้งค่า เช่น `8/10` เป็นค่าเริ่มต้นสำหรับนักเรียนที่ยังไม่มีคะแนน หลัง Scan ยังแก้เป็นรายคนได้
8. นักเรียนที่มีคะแนนเดิมจะแสดงคะแนนเดิม ไม่ใช้ค่าเริ่มต้นเขียนทับทันที
9. Validation คะแนน: ตัวเลข, ไม่ติดลบ, ไม่เกินคะแนนเต็ม และค่าเริ่มต้นต้องอยู่ระหว่าง `0–คะแนนเต็ม`
10. Scan ต่อเนื่อง ไม่ต้อง Refresh และไม่ต้องกด “Scan ต่อ”
11. ป้องกัน QR เดิม trigger ซ้ำด้วย lock/cooldown 1.25 วินาที
12. Scan ผิดห้องจะไม่บันทึกโดย default
13. บันทึกคะแนนลง Supabase ทันทีทีละคน ไม่ได้รอบันทึกรวม
14. หลัง Database commit สำเร็จจึง update app state และ cell คะแนน; ถ้าล้มเหลวจะคงข้อมูลเดิมบนหน้าจอ
15. ไม่สร้างประวัติการแก้คะแนนใหม่; ครูแก้ค่าปัจจุบันได้โดยตรง
16. กล้องมือถือขอ permission ผ่าน `Html5Qrcode.getCameras()`, เลือกกล้องหลัง และ fallback เป็น `facingMode: environment`
17. เมื่อเปิดกล้องไม่สำเร็จ มีข้อความแยกตามสาเหตุและปุ่ม **อนุญาตกล้อง / ลองใหม่**
18. LINE in-app browser บางรุ่นไม่รองรับ WebRTC camera ให้แนะนำเปิดใน Safari/Chrome; ยังมีช่องกรอกรหัส QR เป็น fallback
19. QR ประจำตัวรุ่นใหม่ใช้ `CKSTU:<studentCode>` หนึ่งรหัสต่อคน ใช้ข้ามห้อง วิชา และปีการศึกษา; QR รุ่นเดิม `CKSTU:<classId>:<studentId>` ยังสแกนได้
20. หน้าพิมพ์สร้างภาพ QR สดจากข้อมูลในเบราว์เซอร์ ไม่มีภาพหรือ payload QR ประจำตัวเก็บในฐานข้อมูล; นักเรียนที่ไม่มีรหัสหรือมีรหัสซ้ำในห้องจะไม่ได้ QR และเห็นข้อความให้แก้ข้อมูล

ข้อควรระวัง:

- ช่องคะแนนตั้งค่า `#qr-score-default-score` ต้องไม่เป็น `readonly`; จะ disabled เฉพาะก่อนเลือกงานเพราะยังไม่รู้คะแนนเต็ม
- ตัวเลขหลัง `/` ต้องแก้ไม่ได้และมาจาก `item.max` เท่านั้น
- คะแนนเดิมของนักเรียนต้องมีสิทธิ์เหนือ default score
- ห้ามใช้ `window.location.reload()` หลังบันทึก
- คะแนนและเช็กชื่อใช้แถวในตาราง SQL หลังติดตั้ง migration; JSON เดิมมีไว้สำหรับช่วงเปลี่ยนผ่านเท่านั้น

---

## 4. โครงสร้างข้อมูลและการบันทึก

ระบบบันทึกแบบรายแถว/รายคอลัมน์อยู่ใน `js/relational-sync.js` และ migration
`supabase/migrations/202608260001_classkru_relational_schema.sql`:

- แหล่งข้อมูลหลักบน Cloud เป็น 8 ตาราง: `teacher_profiles`, `classrooms`, `students`, `classroom_students`, `timetable_entries`, `attendance_records`, `score_items`, `student_scores`
- migration ทำงานใน transaction, ใช้ `create ... if not exists` / `on conflict ... do nothing` และ seed จาก `classmanager_profiles.state` โดยไม่แก้หรือลบ JSON เดิม
- PK ของข้อมูลเดิมยังใช้ `class.id`, `student.id`, `scores.items[].id`; FK ที่เกี่ยวข้องรวม `teacher_id` เพื่อกันข้อมูลข้ามบัญชี
- `saveState()` diff จาก snapshot ล่าสุด: คะแนนหนึ่งช่องเป็น upsert/update หนึ่งแถวใน `student_scores`; เช็กชื่อหนึ่งช่องเป็นหนึ่งแถวใน `attendance_records`; การแก้ entity เดิมส่งเฉพาะคอลัมน์ที่เปลี่ยน
- การสร้าง/import หลายรายการ batch เฉพาะแถวใหม่ตามตารางและลำดับ FK เพื่อลดจำนวน request
- การลบใช้ `deleted_at` (soft delete) ไม่มี audit/history และไม่มีตาราง backup/offline/migration เพิ่ม
- คิวที่รอส่งอยู่ใน localStorage ของ browser เท่านั้น แยกตาม `teacher_id` และส่งตามลำดับ จึงไม่มี operation ใหม่แซงรายการเก่า
- ถ้า 8 ตารางยังไม่ถูกติดตั้ง แอป fallback ไปใช้ `classmanager_profiles.state`; ถ้าเคยตรวจพบตารางแล้วแต่เน็ตขาด แอปเก็บ local/queue และจะไม่ fallback ไปเขียน JSON ทั้งก้อน
- RLS ถูก enable + force ทุกตาราง และทุก policy ผูก `teacher_id = auth.uid()`; anon ไม่มีสิทธิ์ตารางเหล่านี้
- `supabase/tests/relational_rls_smoke.sql` ทดสอบ INSERT/UPDATE รายแถว, FK, soft delete, cross-tenant denial และ physical DELETE denial ภายใน transaction ที่ rollback เสมอ
- migration `202608260002_function_execute_hardening.sql` revoke สิทธิ์ EXECUTE เริ่มต้นจาก `PUBLIC` แล้ว grant เฉพาะ RPC ที่ครูหรือ QR นักเรียนต้องใช้

แอปเป็น Vanilla JavaScript + Supabase ใช้ localStorage เป็น working copy และใช้ 8 ตารางเป็น Cloud canonical state

โครงคะแนนภายในแต่ละห้อง:

```text
class.scores = {
  config,
  items[],
  marks{},
  gradeOverride{}
}
```

QR score ใช้:

```text
class.id
scores.items[].id
student.id
scores.marks[itemId][studentId]
```

หลังติดตั้งตาราง การเขียน Cloud ใช้ `persistRelationalState()`; `enqueueCloudStateWrite()` คงไว้เฉพาะ fallback ก่อนติดตั้ง schema ห้ามเขียน `classmanager_profiles.state` ทั้งก้อนจาก feature โดยตรง

ลำดับ deploy ที่ปลอดภัย:

1. สำรองฐานข้อมูล/Supabase snapshot และ export `classmanager_profiles` ก่อนเริ่ม
2. deploy frontend รุ่นนี้ก่อนได้ เพราะจะ fallback เป็น JSON เมื่อยังไม่พบ `teacher_profiles`
3. รัน migration ใน Supabase แล้วตรวจจำนวน teacher/class/student/attendance/score เทียบ JSON
4. บังคับ refresh อุปกรณ์ที่เปิดค้าง เพื่อไม่ให้ frontend รุ่นเก่าเขียนเฉพาะ JSON ต่อหลัง cutover
5. ห้าม drop `classmanager_profiles` หรือ JSON เดิมในช่วงตรวจสอบ

Rollback: migration ไม่แตะ JSON เดิมและอยู่ใน transaction จึง rollback ระหว่างรันได้อัตโนมัติ หากต้องถอยหลังหลังเริ่มมีข้อมูลใหม่ใน 8 ตาราง ห้าม drop ตาราง ให้หยุด deploy และกู้จาก database backup/forward-fix ก่อน เพราะ JSON เดิมจะไม่มีรายการที่เกิดหลัง cutover

---

## 5. Workflow ที่ผู้ใช้ต้องการ

เมื่อผู้ใช้สั่งแก้หรือสร้าง feature:

1. ตรวจโครงสร้างเดิมก่อน
2. แก้เฉพาะส่วนที่เกี่ยวข้องและรักษาพฤติกรรมเดิม
3. เพิ่ม/ปรับ test ตามความเสี่ยง
4. หลังแก้ JS/CSS ให้รัน `bump-version.sh`
5. รัน test และ `git diff --check`
6. Commit ภาษาไทยบน branch ปัจจุบัน
7. Push branch
8. Fetch `origin/main` และตรวจว่า fast-forward ปลอดภัย
9. Push `HEAD:main` ตาม workflow เดิมของผู้ใช้
10. ตรวจ Production ทั้ง HTML, asset version และ behavior marker ที่เกี่ยวข้อง
11. อัปเดต “สถานะ Repository และ Production” ในไฟล์นี้เมื่อ commit/version เปลี่ยน

อย่าเปิดหน้า GitHub Login หรือขอให้ผู้ใช้ login หาก `git push` ทำงานได้อยู่แล้ว

อย่ารวมไฟล์นอกขอบเขตที่ผู้ใช้มีอยู่ใน worktree โดยไม่ตั้งใจ โดยเฉพาะ `BUSINESS_STRATEGY.md`

---

## 6. คำสั่งทดสอบที่ใช้ได้บนเครื่องนี้

Node.js:

```powershell
$node = 'C:\Users\USER\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
& $node --check js/qr-scores.js
& $node --check js/relational-sync.js
& $node tests/qr-scores.test.cjs
& $node tests/cloud-write-queue.test.cjs
& $node tests/relational-sync.test.cjs
git diff --check
```

Supabase Production smoke test (ทุก write ถูก rollback):

```powershell
supabase db query --linked --file supabase/tests/relational_rls_smoke.sql
```

Bump asset version ผ่าน Git Bash:

```powershell
& 'C:\Program Files\Git\usr\bin\bash.exe' --noprofile --norc -c 'export PATH=/usr/bin:/mingw64/bin:$PATH; ./bump-version.sh'
```

ก่อน push `main`:

```powershell
git fetch origin main
git merge-base --is-ancestor origin/main HEAD
git push origin HEAD:main
git branch -f main HEAD
```

---

## 7. Definition of Done สำหรับงานต่อไป

งานยังไม่ถือว่าเสร็จเพียงเพราะแก้โค้ดแล้ว ต้อง:

- behavior ตรงกับคำอธิบายของผู้ใช้
- test ที่เกี่ยวข้องผ่าน
- ไม่มี syntax error
- asset version ถูก bump เมื่อแตะ JS/CSS
- commit/push ตาม workflow เดิม
- Production ได้รับ version ใหม่และตรวจ marker สำคัญแล้ว
- `HANDOFF.md` สะท้อนสถานะล่าสุดเพียงพอให้แชทใหม่ทำงานต่อได้

หากเป็นเรื่องกล้อง ต้องแจ้งตรงไปตรงมาว่า automated test ตรวจ logic/header ได้ แต่การอนุญาตกล้องจริงยังขึ้นกับอุปกรณ์ สิทธิ์เว็บไซต์ และ in-app browser ของผู้ใช้

---

## 8. Feature ล่าสุด — Slider เลือกนักเรียนบนมือถือ

ไฟล์หลัก:

- `js/attendance.js` — ลำดับนักเรียน, slider selection, สถานะปัจจุบัน และการบันทึก
- `css/06-attendance.css` — การ์ด, แถบเลื่อนมือถือ, ปุ่มสถานะ และ completion banner
- `index.html` — markup slider, ตัวบอกตำแหน่ง และปุ่มสถานะ
- `tests/attendance-carousel.test.cjs` — regression test ป้องกัน slider ไปบันทึกสถานะ

พฤติกรรมปัจจุบัน:

1. รายชื่อนักเรียนทั้งห้องใช้ snapshot ที่อยู่ใน `appState` และไม่เรียก Cloud ใหม่ทุกครั้งที่ปัด
2. ลากแถบ `range` แบบ `step=1` เพื่อกระโดดไปนักเรียนลำดับใดก็ได้; การเลื่อนไม่บันทึกสถานะ
3. การ์ดอัปเดตตามแถบแบบ real time พร้อมชื่อ เลขที่ และตำแหน่งปัจจุบัน
   แถบเลื่อนไม่แสดงชื่อหรือเลขที่ซ้ำ เพราะข้อมูลเหล่านี้มีอยู่บนการ์ดแล้ว
   พื้นที่ slider แยกจากการ์ดด้วยระยะคั่นและพื้นหลัง เพื่อไม่บังข้อมูลบนจอมือถือเตี้ย
   ไม่มีข้อความแนะนำการใช้ slider บนการ์ด เพื่อลดข้อมูลซ้ำและความรก
4. มีการ์ดจางของคนก่อนหน้าและคนถัดไป พร้อมปุ่มลูกศรสำหรับขยับทีละคน
5. การแตะตัวการ์ดไม่ตั้งสถานะ “มา” อีกต่อไป
6. ปุ่ม `มา / สาย / ขาด / ลา` ด้านล่างเป็นทางเดียวสำหรับบันทึกสถานะ
7. หลังเลือกสถานะ UI บันทึกเข้า state/Cloud queue แล้วเลื่อนไปคนถัดไปโดยไม่รอ network
8. ย้อนกลับมาคนที่เช็คแล้วจะเห็นปุ่มเดิม active และสามารถกดแก้สถานะได้
9. เมื่อเช็คครบ การ์ดยังคงอยู่เพื่อย้อนตรวจ พร้อมแถบ “เช็คชื่อครบทุกคนแล้ว” และปุ่มเสร็จสิ้น
10. จุดต้นและท้ายรายการหยุด ไม่วนกลับ เพื่อไม่ให้ครูหลงตำแหน่ง

ผลตรวจครั้งล่าสุด:

- syntax, carousel regression, QR score และ cloud write queue tests ผ่าน
- ตรวจ Production ด้วย viewport มือถือ 390×844 แล้ว: การ์ดนักเรียน แถบเลื่อน และปุ่มสถานะไม่ทับกัน
- เลื่อนจากคนที่ 1 ไปคนที่ 20 ได้แบบ real time ขณะที่ยอดยังเป็น `เช็คแล้ว 0 / 40` ยืนยันว่าการเลื่อนไม่บันทึกสถานะ
---

## 9. Feature ล่าสุด — Navigation shell ชุดเดียวทุกขนาดจอ

ไฟล์หลัก:

- `js/shell.js` — `APP_NAVIGATION`, การสร้างเมนู และ active state กลาง
- `index.html` — เหลือ mount point ของเมนู Desktop, Mobile quick และ Mobile more
- `css/01-base-layout.css` — Sidebar rail 80px ขยายเป็น 264px เมื่อ hover/focus
- `css/08-responsive-toast.css` — Tablet rail 72px ขยายเป็น 236px
- `css/06-attendance.css` — overlay เช็คชื่อเยื้องตรงกับ rail
- `tests/navigation-shell.test.cjs` — regression test ป้องกันเมนูซ้ำและ breakpoint ถอยหลัง

พฤติกรรม:

1. รายการ ชื่อ ไอคอน ลำดับ และหน้าที่สังกัดของเมนูทุกขนาดจออยู่ใน `APP_NAVIGATION` ชุดเดียว
2. Desktop แสดง rail แบบไอคอนเพื่อคืนพื้นที่ให้หน้าวันนี้ และขยายให้เห็นข้อความเมื่อใช้เมาส์หรือคีย์บอร์ด
3. Mobile คง 6 ปุ่มด่วน และสร้าง 4 รายการในแผ่น “เพิ่มเติม” จากข้อมูลชุดเดียวกัน
4. หน้า `students`, `scores`, `reports` และ `checkin` ยังทำให้เมนูห้องเรียนบน Desktop active; Mobile ใช้ปุ่มเช็คชื่อของตัวเอง
5. ตรวจ local viewport 1440×900 และ 390×844: จำนวน/ลำดับเมนู, breakpoint, ระยะ main content และ JavaScript console ผ่าน
6. Production version 393 ตอบ HTTP 200 และตรวจ marker `desktop-navigation`, `mobile-more-navigation`, `APP_NAVIGATION`, `renderAppNavigation` และ sidebar rail ครบแล้ว

---

## 10. Feature ล่าสุด — ระบบไกด์/ทัวร์ในแอป

ไฟล์หลัก:

- `js/extras.js` — Tour engine, guide steps, auto-start per screen และ helper `notifyTourAction()`
- `css/01-base-layout.css` — mask/ring/bubble, action chips, mini checklist และการ์ด help แบบ primary
- `index.html` — ปุ่มไกด์ในศูนย์ช่วยเหลือ, id ของปุ่ม/ฟอร์มที่ไกด์ใช้ highlight, modal class/period/student
- `js/shared-utils.js` — action hooks ตอนเปิด modal และบันทึกห้อง/นักเรียน/คาบ
- `js/classrooms.js`, `js/students.js`, `js/attendance.js`, `js/shell.js` — action hooks และ auto-start guide เมื่อเข้าหน้าจอ

พฤติกรรมปัจจุบัน:

1. ศูนย์ช่วยเหลือมีปุ่มทัวร์แยกหมวด: เริ่มต้นใช้งาน, หน้าแรก, เพิ่มนักเรียน, เช็คชื่อ, คะแนน, ตารางสอน, เพิ่มคาบสอน, รายงาน, เครื่องมือ และเกม
2. ทัวร์เริ่มต้นเดิมถูกเปลี่ยนให้ใช้ `startGuide('classrooms')` และยังปิด onboarding ด้วย `finishOnboarding()` เหมือนเดิม
3. Tour engine รองรับ `skipIf`, `blockTarget`, `waitForActionOnly`, `allowInteraction`, `noMask`, `bubble:false` และเลือก selector ตัวที่มองเห็นจริง
4. ขั้นที่ต้องให้ครูทำจริงเดินต่อผ่าน action เช่น `class-modal-opened`, `class-created`, `students-opened`, `student-modal-opened`, `student-added`, `period-modal-opened`, `period-added`
5. มี `notifyTourAction()` กัน hook ในไฟล์อื่นพังถ้า Tour ยังไม่พร้อมในบางบริบททดสอบ
6. เมื่อเปิดหน้าจอสำคัญครั้งแรก ระบบเรียก `maybeStartScreenGuide()` เพื่อเปิดไกด์อัตโนมัติถ้าไม่เคยเห็นและมีข้อมูลพร้อม
7. ถ้าไม่มีห้อง ระบบพากลับไปสร้างห้องก่อน; ถ้าไม่มีนักเรียนและเปิดไกด์คะแนน/รายงานด้วยมือ ระบบพาไปไกด์เพิ่มนักเรียนก่อน
8. `students` ถูกเพิ่มใน guide screen map แล้ว เพื่อให้ auto-guide ของหน้ารายชื่อนักเรียนไม่หายเงียบ
9. Asset cache version ถูก bump เป็น `382` ผ่าน `./bump-version.sh` ครอบทุก HTML ที่มี JS/CSS query version

ข้อจำกัดการตรวจครั้งล่าสุด:

- `node --check js/*.js`, `tests/attendance-carousel.test.cjs`, `tests/qr-scores.test.cjs`, `tests/cloud-write-queue.test.cjs` และ `git diff --check` ผ่าน
- เปิด local server แบบ bind `127.0.0.1:4174` แล้ว asset หลักทั้งหมดโหลด `200` และ browser console ไม่มี error ตอนหน้า login
- ยังไม่ได้คลิก flow ไกด์หลังล็อกอินจริง เพราะ browser session อยู่ที่ login overlay และไม่มีการกรอกบัญชีในงานนี้

---

## 11. Feature ล่าสุด — ปพ.5 คุณลักษณะอันพึงประสงค์

ไฟล์หลัก:

- `js/pp5.js` — สร้างเอกสาร ปพ.5, คำนวณผลสรุปคุณลักษณะฯ จาก 8 รายข้อ, autosave, print/PDF และ Excel
- `css/pp5.css` — สไตล์ช่องผลสรุปที่คำนวณแล้วในเอกสาร
- `tests/pp5.test.cjs` — regression test เกณฑ์สรุป `ดีเยี่ยม / ดี / ผ่าน / ไม่ผ่าน`, autosave, summary และ export data

พฤติกรรมปัจจุบัน:

1. คุณลักษณะอันพึงประสงค์ทั้ง 8 ข้อใช้ค่า `0 ไม่ผ่าน`, `1 ผ่าน`, `2 ดี`, `3 ดีเยี่ยม`
2. ช่อง “ผลสรุปโดยครู” ไม่ใช่ select แยกแล้ว แต่แสดงผลคำนวณจาก 8 ช่องรายข้อเพื่อให้ตรงกับแบบ ปพ.5
3. ถ้ามีรายข้อใดเป็น `ไม่ผ่าน` ผลสรุปเป็น `ไม่ผ่าน`
4. ถ้ารายข้อยังไม่ครบ 8 ข้อ ผลสรุปแสดง `—` และนับเป็นข้อมูลยังไม่ครบ
5. `ดีเยี่ยม` ต้องมีระดับดีเยี่ยม 5-8 ข้อ และไม่มีข้อใดต่ำกว่าดี
6. `ดี` ใช้เมื่อไม่มีข้อใดต่ำกว่าผ่าน และเข้าเกณฑ์ระดับดีตามจำนวนข้อที่ได้ระดับดีขึ้นไป
7. `ผ่าน` ใช้เมื่อทุกข้ออย่างน้อยผ่าน แต่ยังไม่ถึงเกณฑ์ดี
8. ผล “อ่าน คิดวิเคราะห์ และเขียน” ยังเป็นรายการประเมินแยกตามแบบเดิม

ผลตรวจครั้งล่าสุด:

- `node --check js/pp5.js` ผ่าน
- `node --check js/scores.js` ผ่าน
- `node tests/pp5.test.cjs` ผ่าน
- `node tests/score-report.test.cjs` ผ่าน
- `node tests/relational-sync.test.cjs` ผ่าน
- `git diff --check` ผ่าน

## 12. Media Studio AI response-format fix (2026-09-22)

Production jobs reached the worker and OpenRouter but failed as `ai_invalid_response` because the OpenRouter request only instructed the model to return JSON; it did not enforce the Planner schema. `api/_lib/media-ai.js` now sends OpenRouter `response_format` with strict JSON Schema and `provider.require_parameters=true`, while retaining the existing server-side validation. The adapter test asserts this contract. This is a backward-compatible request change; no database schema change is required.

Validation completed: `node --check api/_lib/media-ai.js`, `npm.cmd run test:media` (21/21). Pending: deploy to Vercel Production, then submit one new message and verify the job changes from `queued` to `succeeded` and a `result` request appears in Network.

## 13. Media Studio dedicated Planner contract (2026-09-22)

Added `api/_lib/media-planner-ai.js` for Media Studio plan jobs. It uses `OPENROUTER_MEDIA_PLANNER_API_KEY` and `OPENROUTER_MEDIA_PLANNER_MODEL` when configured, with the legacy router key/model retained only as a backward-compatible fallback. The planner returns a strict `media_brief`, suggested directions, open questions, and `ready_to_build`; the existing build adapter remains unchanged. `media-service.js` normalizes the new brief and keeps legacy display aliases during UI migration. No database table or browser credential changes are required.

Validation completed: `npm.cmd run test:media` (22/22), `node tests/navigation-shell.test.cjs`, syntax checks, and `git diff --check`. Pending: add the new key/model to Vercel Production and Preview, deploy, then test a new conversation.

## 14. Image generation first flow (2026-09-22)

Added the first image-generation path using OpenRouter's dedicated `/api/v1/images` endpoint. Media Studio image jobs reuse the configured planner key temporarily, use `OPENROUTER_MEDIA_IMAGE_MODEL` (default `google/gemini-3.1-flash-image`), persist the base64 image privately under the teacher's Media Storage, expose an authenticated image retrieval action, and show a Preview after the image job succeeds. The existing planner and HTML build paths remain separate.

Validation completed: `npm.cmd run test:media` (23/23), navigation regression, syntax checks, and `git diff --check`. Pending: deploy and test with a real image model/key; image generation may incur provider charges.

## 16. Motion/game web build flow (2026-09-22)

เปลี่ยนปุ่มสร้างสื่อใน Media Studio ให้รองรับ `motion` และ `game` ก่อน โดยใช้ build adapter เดิมที่สร้าง artifact เป็น HTML/CSS/JavaScript และไม่เรียก Image API. ปุ่มยืนยันจะแสดงสรุปแนวทางที่แก้ไขได้ แล้วส่ง `kind: build`, `media_type` และ `prompt_override` ไปยัง Planner build flow; backend ใช้ prompt ที่แก้ไขแล้วเป็นคำสั่งสร้าง artifact และยังผ่าน artifact policy/browser review เดิม.

Asset version ถูก bump เป็น `493`. Validation: media tests 23/23, navigation regression, syntax checks และ `git diff --check` ผ่าน. ต้อง deploy Production แล้วทดสอบโปรเจกต์ที่ Planner เลือก `motion` หรือ `game`; ขั้นถัดไปคือเชื่อมปุ่ม preview/link ไปยัง Media Host หลัง artifact สร้างสำเร็จ.

## 15. Editable image brief confirmation (2026-09-22)

ปรับ Media Studio ให้ใช้ Planner brief เป็นข้อมูลหลักในแผงขวา แสดงหัวข้อ กลุ่มผู้เรียน สารที่อยากสื่อ แนวคิด โครงสร้างเนื้อหา ทิศทางภาพ โทน แนวทางแนะนำ และคำถามต่อยอด พร้อมปุ่ม `สร้างภาพ` เมื่อมีหัวข้อและประเภทสื่อเป็น `image` โดยไม่บังคับ `ready_to_build` ก่อนหน้า

เมื่อกด `สร้างภาพ` ระบบเปิดหน้าต่างยืนยันตรงกลาง workspace ให้ครูแก้ไข เพิ่ม หรือลบข้อความสรุปได้ แล้วส่งข้อความที่แก้ไขผ่าน `image_prompt` ไปยัง image adapter ก่อนยืนยันสร้างภาพ ปุ่ม `กลับไปคุยต่อ` ปิดหน้าต่างโดยไม่สร้างงาน และ image preview จะไม่ซ้ำเมื่อมีการโหลด/poll ซ้ำ

Backend เก็บ `image_prompt` ไว้ใน job และใช้เป็น prompt จริงของ OpenRouter image request; request-key เดิมจะถูกตรวจสอบ prompt ด้วยเพื่อป้องกันการนำงานคนละ prompt กลับมาใช้ซ้ำ Asset version ถูก bump เป็น `492`.

Validation completed: `npm.cmd run test:media` (23/23), `node tests/navigation-shell.test.cjs`, syntax checks for changed JS files, and `git diff --check`. Pending: deploy commit to Vercel Production and test the modal/edit/confirm flow with a real image model/key.
## 17. Unified Web Media image flow (2026-09-22)

ปรับประเภท `image` ให้ใช้ build flow เดียวกับ `motion` และ `game` แล้ว โดยสร้างเป็นโปสเตอร์ อินโฟกราฟิก ใบงาน หรือแผนภาพด้วย HTML/CSS/inline SVG/JS แทนการเรียก Image API และยังคง `media_type: image` ใน Planner เพื่อแยกความหมายของสื่อ ทั้งสามประเภทใช้ `kind: build`, editable confirmation prompt และ artifact storage/review เดียวกัน Asset version เป็น `494`.
## 18. Media Studio daily quota removed (2026-09-22)

ปลด daily request quota ของ Media Studio ออกแล้ว จึงไม่มี `daily_limit` สำหรับการสนทนาและสร้างสื่ออีกต่อไป แต่คง pending queue, project และ version limits เพื่อกันงานซ้อนและรักษาความเสถียรของระบบ. Regression test ยืนยันว่า quota records เก่าไม่บล็อกการ enqueue งานใหม่.
## 19. Static image artifact support (2026-09-22)

Build prompt now defines `image` as static Web Media (poster/infographic/worksheet/diagram) built with HTML/CSS/inline SVG, while motion and game remain compact web artifacts. Static image artifacts may return an empty `js` string; the artifact validator accepts this safely and continues to validate all HTML/CSS and any non-empty JavaScript. Tests cover the empty-JS static artifact case and assert the build contract includes media-type guidance.
## 20. Media artifact preview and publish UI (2026-09-22)

Media Studio now shows a “สื่อที่สร้างแล้ว” card in the planner panel after a reviewed build version succeeds. Teachers can use `ทดลองเล่น` to issue and open a 15-minute Preview link on Media Host, then `เผยแพร่` after confirmation to create a published link; the card then shows `เปิดลิงก์สื่อ`. This reuses existing preview/publish APIs and encrypted artifact storage. Asset version is `495`.
## 21. ขอบเขต Web Media ที่ตกลงร่วมกัน (2026-09-22)

Media Studio มีเป้าหมายให้ครูเริ่มจากไอเดียง่าย ๆ แล้วค่อยร่วมกันทำให้ชัดเจนเป็น Brief ก่อนสร้างสื่อ ไม่บังคับให้ครูเขียน prompt สมบูรณ์ตั้งแต่แรก

### ความหมายของประเภทสื่อ

- `image` คือสื่อภาพนิ่งแบบ Web Media เช่น โปสเตอร์ อินโฟกราฟิก ใบงาน หรือแผนภาพ สร้างจาก HTML/CSS/inline SVG เป็นค่าเริ่มต้น ไม่ต้องพึ่งไฟล์ PNG/JPG หรือ image model
- `motion` คือสื่อเคลื่อนไหวขนาดกะทัดรัดในหน้าเดียว มีเนื้อหา 3–5 ช่วง ใช้ HTML/CSS/SVG/JavaScript และมีปุ่มเล่นหรือเริ่มใหม่
- `game` เป็นคำที่สื่อสารกับครูได้ง่าย แต่ในเชิงผลิตภัณฑ์หมายถึงสื่อโต้ตอบขนาดเล็ก ไม่ใช่เกมเต็มรูปแบบ: มีกลไกหลักเพียงหนึ่งอย่าง รายการ/โจทย์ 3–5 ข้อ feedback และปุ่มเริ่มใหม่

### ลำดับการทำงาน

1. ครูส่งไอเดียหรือหัวข้อขั้นต่ำ
2. Planner สนทนาและสะสมเป็น Brief
3. ครูเลือกประเภทสื่อ และตรวจ/แก้ไขสรุปก่อนยืนยันสร้าง
4. ระบบส่ง Brief ที่ยืนยันแล้วพร้อมสัญญาขอบเขตการสร้าง (build contract) ให้ AI สร้าง artifact
5. artifact ผ่าน validation, ตรวจใน preview, แล้วครูจึงเลือกเผยแพร่หรือเปิดลิงก์สื่อ

### Brief และขอบเขตที่ต้องส่งให้ AI สร้างสื่อ

Brief ควรครอบคลุมอย่างน้อย: เจตนาการสื่อสารหรือสิ่งที่ผู้เรียนควรเข้าใจ, ประเภทสื่อ, เนื้อหาหลัก, ขอบเขต/จำนวนช่วงหรือจำนวนโจทย์, แนวภาพหรือแนวการโต้ตอบ, และข้อจำกัด เช่น ภาษา ข้อความในภาพ หรือสิ่งที่ไม่ต้องการ

หากครูยังไม่ระบุรายละเอียด ระบบใช้ค่าเริ่มต้นขนาดเล็กและเหมาะกับสื่อการสอน แต่ต้องแสดงให้ครูเห็นและแก้ไขได้ในหน้าต่างยืนยัน ไม่ให้ AI ตีความขอบเขตขนาดใหญ่เองโดยเงียบ ๆ

### ข้อมูลและความปลอดภัย

- เก็บแผน/ผลลัพธ์ในพื้นที่ส่วนตัวของครู (`users/{teacher_id}/...`) และไม่ส่งข้อมูลนักเรียนรายบุคคลไปยัง AI
- artifact ต้องเป็น HTML/CSS/JS ที่ผ่าน validation; ห้ามพึ่ง network ภายนอกหรือรันโค้ดอันตราย
- Preview เป็นลิงก์ชั่วคราวสำหรับตรวจงาน ส่วนเผยแพร่เป็นลิงก์ที่ใช้ต่อได้จนกว่าจะถูกยกเลิก/เก็บโครงการ
