# HANDOFF — บริบทสำหรับสานต่องาน ClassKru

> อัปเดตล่าสุด: 27 สิงหาคม 2569
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
- Branch ทำงาน: `codex/qr-continuous-score-scan`
- QR feature baseline: commit `fa6c1ca`
- ค่า `HEAD`, `main` และ remote อาจมี documentation commit หลัง baseline นี้ ให้ตรวจจาก Git ทุกครั้งและไม่ยึดเลข commit ในไฟล์นี้เป็นหลัก
- Asset version ปัจจุบัน: `393` (bump จาก 392 เพราะ Production cache มี asset เก่าที่ใช้เลขซ้ำ)
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
