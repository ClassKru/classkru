# 🗂️ ตารางแบ่งความเป็นเจ้าของไฟล์ (File Ownership)

เอกสารนี้บอกว่า **ใครดูแลไฟล์ไหน** เพื่อให้หลายคนทำงานพร้อมกันได้โดยไม่ชนกัน
อ่านให้จบก่อนเริ่มแก้โค้ดครั้งแรก

> **สถานะ:** แยกไฟล์ JS เสร็จแล้ว (เฟส 2) — โค้ดอยู่ในโฟลเดอร์ `js/`
> การแยกทำแบบ "byte-identical" (ต่อไฟล์ทั้งหมดกลับ = `app.js` เดิมเป๊ะ) → พฤติกรรมไม่เปลี่ยน
> **สำคัญ:** `js/core.js` ต้องโหลดก่อนเสมอ (มีตัวแปร/ค่าคงที่รวมที่ไฟล์อื่นใช้)

---

## กฎ 3 ข้อ (จำแค่นี้พอ)

1. **แก้ไฟล์ของตัวเอง → ลุยเลย** ไม่ต้องบอกใคร
2. **แก้ไฟล์ร่วม 🔒 → ทักในแชตทีมก่อน** ว่ากำลังแก้ตรงไหน กันชน
3. **ทุกงาน = 1 branch + 1 PR เสมอ** อีกคนรีวิวก่อน merge (ไม่มีข้อยกเว้น)

> ทำไมต้องรีวิว: บางที git รวมงานผ่าน แต่แอปพัง (เช่น อีกคนเปลี่ยนชื่อฟังก์ชันใน `shared.js`
> ที่โค้ดเราเรียกอยู่) — CI จับ syntax ได้ แต่จับแบบนี้ไม่ได้ ต้องใช้สายตาคนรีวิว

---

## 📁 ไฟล์ JavaScript (โฟลเดอร์ `js/`) — โหลดเรียงตามนี้

| ไฟล์ | คุมอะไร | เจ้าของหลัก |
|---|---|---|
| `js/core.js` 🔒 | ตัวแปร/ค่าคงที่รวม (`appState`, วันเดือน, สีการ์ด), Supabase config, boot (`DOMContentLoaded`) | **ร่วม** (Supakit คุม) — **โหลดก่อนเสมอ** |
| `js/auth.js` 🔒 | login / signup / google, เปลี่ยนรหัสผ่าน, โปรไฟล์, `onLoginSuccess` (+ util วันที่) | **Supakit** |
| `js/shell.js` 🔒 | routing `#hash` (`getScreenFromHash`, `navigateToWebScreen`), นำเข้าตารางสอน (เปิด/ปิด) | **ร่วม** (Supakit คุม) |
| `js/dashboard.js` | หน้าหลัก + ปฏิทิน | เดฟใหม่ |
| `js/classrooms.js` | ห้องเรียนวิชาสอน | เดฟใหม่ |
| `js/students.js` | จัดการรายชื่อเด็ก | เดฟใหม่ |
| `js/timetable.js` | ตารางสอน + ตั้งค่าคาบ | เดฟใหม่ |
| `js/reports.js` | รายงาน (today/weekly/term/overall) + นำเข้า/ส่งออก Excel + mapping | เดฟใหม่ |
| `js/attendance.js` | เช็คชื่อ / swipe / attendance matrix (+ `showToast`/`showConfirm` shared UI) | เดฟใหม่ |
| `js/shared-utils.js` 🔒 | modal ห้อง/เด็ก, color picker, ลบข้อมูล, `initAppState`, sync cloud, logout | **ร่วม** (Supakit คุม) |
| `js/extras.js` | OCR สแกนรายชื่อ, `isMobileView`, onboarding tour | เดฟใหม่ |

> **หมายเหตุความไม่บริสุทธิ์:** การแยกทำแบบ byte-identical (ไม่สลับลำดับโค้ด เพื่อความปลอดภัยสูงสุด)
> จึงมี util ร่วมบางตัวติดอยู่ในไฟล์ที่ไม่ตรงหน้าที่เป๊ะ เช่น `showToast`/`showConfirm` อยู่ใน `attendance.js`
> ถ้าจะแตะพวกนี้ให้ถือเป็น "ของร่วม" (ทักก่อน) แม้จะอยู่ในไฟล์ของเดฟ

## 🎨 ไฟล์ CSS

| ไฟล์ | คุมอะไร | เจ้าของหลัก |
|---|---|---|
| `style.css` 🔒 | สไตล์ทั้งหมด (ยังไม่แยก — รอเฟส 2b) | **ร่วม — ทักก่อนแก้** |

> การแยก CSS (`base.css` + `screens.css`) จะทำเป็น PR แยกทีหลัง

## 📄 ไฟล์ HTML

| ไฟล์ | คุมอะไร | เจ้าของหลัก |
|---|---|---|
| `index.html` 🔒 | โครงทั้งแอป (คงไว้ไฟล์เดียว ไม่แยก) | **ร่วม — ทักก่อนแก้** |

---

## 🔒 ไฟล์ร่วม = ต้องทักก่อนแตะ

ไฟล์เหล่านี้เท่านั้น:

- `js/core.js`
- `js/auth.js`
- `js/shell.js`
- `js/shared-utils.js`
- `style.css`
- `index.html`

ที่เหลือ **ต่างคนต่างลุยได้เลย** ไม่ต้องรอกัน

---

## 🌿 Workflow ย่อ

```
1. git checkout main && git pull          # อัปเดตล่าสุดก่อนเริ่มเสมอ
2. git checkout -b feature/ชื่องาน          # 1 งาน = 1 branch
3. ...แก้โค้ด...
4. git push -u origin feature/ชื่องาน
5. เปิด PR → รอ CI เขียว → อีกคนรีวิว → merge
6. Vercel deploy ขึ้น production อัตโนมัติจาก main
```

- **Production:** https://classkru-kohl.vercel.app (deploy จาก branch `main`)
- ห้าม push เข้า `main` ตรงๆ — ต้องผ่าน PR เสมอ
