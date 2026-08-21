# HANDOFF — บริบทสำหรับสานต่องาน ClassKru

> อัปเดตล่าสุด: 21 สิงหาคม 2569
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
- Asset version ปัจจุบัน: `373`
- ฟีเจอร์ล่าสุด: ปรับหน้าเช็คชื่อมือถือเป็น carousel ปัดเพื่อเปลี่ยนนักเรียน และกดปุ่มเพื่อบันทึกสถานะ
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
15. เก็บ `scoreAuditHistory` สำหรับ old/new score, ผู้แก้ และเวลา
16. กล้องมือถือขอ permission ผ่าน `Html5Qrcode.getCameras()`, เลือกกล้องหลัง และ fallback เป็น `facingMode: environment`
17. เมื่อเปิดกล้องไม่สำเร็จ มีข้อความแยกตามสาเหตุและปุ่ม **อนุญาตกล้อง / ลองใหม่**
18. LINE in-app browser บางรุ่นไม่รองรับ WebRTC camera ให้แนะนำเปิดใน Safari/Chrome; ยังมีช่องกรอกรหัส QR เป็น fallback

ข้อควรระวัง:

- ช่องคะแนนตั้งค่า `#qr-score-default-score` ต้องไม่เป็น `readonly`; จะ disabled เฉพาะก่อนเลือกงานเพราะยังไม่รู้คะแนนเต็ม
- ตัวเลขหลัง `/` ต้องแก้ไม่ได้และมาจาก `item.max` เท่านั้น
- คะแนนเดิมของนักเรียนต้องมีสิทธิ์เหนือ default score
- ห้ามใช้ `window.location.reload()` หลังบันทึก
- อย่าสร้างตารางคะแนน schema ใหม่ ปัจจุบันข้อมูลอยู่ใน `classmanager_profiles.state`

---

## 4. โครงสร้างข้อมูลและการบันทึก

แอปเป็น Vanilla JavaScript + Supabase และเก็บ state หลักใน `classmanager_profiles.state`

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

การเขียน Cloud ทุกจุดใช้คิวร่วม `enqueueCloudStateWrite()` ใน `js/shared-utils.js` เพื่อป้องกัน request เก่าเขียนทับ state ใหม่ ห้าม bypass คิวนี้เมื่อแก้ feature คะแนน

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
& $node tests/qr-scores.test.cjs
& $node tests/cloud-write-queue.test.cjs
git diff --check
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

## 8. Feature ล่าสุด — Carousel เช็คชื่อบนมือถือ

ไฟล์หลัก:

- `js/attendance.js` — ลำดับนักเรียน, gesture, สถานะปัจจุบัน และการบันทึก
- `css/06-attendance.css` — การ์ดกลาง, การ์ดซ้อนด้านข้าง, ปุ่มสถานะ และ completion banner
- `index.html` — markup carousel, ตัวบอกตำแหน่ง และปุ่มสถานะ
- `tests/attendance-carousel.test.cjs` — regression test ป้องกัน gesture กลับไปบันทึกสถานะ

พฤติกรรมปัจจุบัน:

1. รายชื่อนักเรียนทั้งห้องใช้ snapshot ที่อยู่ใน `appState` และไม่เรียก Cloud ใหม่ทุกครั้งที่ปัด
2. ปัดซ้ายไปคนถัดไป ปัดขวากลับคนก่อนหน้า; การปัดไม่บันทึกสถานะ
3. มีการ์ดจางของคนก่อนหน้าและคนถัดไป พร้อมปุ่มลูกศรสำรอง
4. การแตะตัวการ์ดไม่ตั้งสถานะ “มา” อีกต่อไป
5. ปุ่ม `มา / สาย / ขาด / ลา` ด้านล่างเป็นทางเดียวสำหรับบันทึกสถานะ
6. หลังเลือกสถานะ UI บันทึกเข้า state/Cloud queue แล้วเลื่อนไปคนถัดไปโดยไม่รอ network
7. ย้อนกลับมาคนที่เช็คแล้วจะเห็นปุ่มเดิม active และสามารถกดแก้สถานะได้
8. เมื่อเช็คครบ การ์ดยังคงอยู่เพื่อย้อนตรวจ พร้อมแถบ “เช็คชื่อครบทุกคนแล้ว” และปุ่มเสร็จสิ้น
9. จุดต้นและท้ายรายการหยุด ไม่วนกลับ เพื่อไม่ให้ครูหลงตำแหน่ง

ข้อจำกัดการตรวจครั้งล่าสุด:

- syntax, carousel regression, QR score และ cloud write queue tests ผ่าน
- in-app Browser บล็อก localhost (`ERR_BLOCKED_BY_CLIENT`) จึงยังไม่ได้ยืนยัน visual layout ด้วย screenshot จริงบนเครื่องมือถือ
