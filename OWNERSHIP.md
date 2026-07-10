# 🗂️ ตารางแบ่งความเป็นเจ้าของไฟล์ (File Ownership)

เอกสารนี้บอกว่า **ใครดูแลไฟล์ไหน** เพื่อให้หลายคนทำงานพร้อมกันได้โดยไม่ชนกัน
อ่านให้จบก่อนเริ่มแก้โค้ดครั้งแรก

> **หมายเหตุ:** โครงไฟล์ด้านล่างเป็นเป้าหมายหลัง "แยกไฟล์" (เฟส 2) เสร็จ
> ระหว่างที่ยังไม่แยก โค้ดทั้งหมดอยู่ใน `app.js` / `style.css` / `index.html`

---

## กฎ 3 ข้อ (จำแค่นี้พอ)

1. **แก้ไฟล์ของตัวเอง → ลุยเลย** ไม่ต้องบอกใคร
2. **แก้ไฟล์ร่วม 🔒 → ทักในแชตทีมก่อน** ว่ากำลังแก้ตรงไหน กันชน
3. **ทุกงาน = 1 branch + 1 PR เสมอ** อีกคนรีวิวก่อน merge (ไม่มีข้อยกเว้น)

> ทำไมต้องรีวิว: บางที git รวมงานผ่าน แต่แอปพัง (เช่น อีกคนเปลี่ยนชื่อฟังก์ชันใน `shared.js`
> ที่โค้ดเราเรียกอยู่) — CI จับ syntax ได้ แต่จับแบบนี้ไม่ได้ ต้องใช้สายตาคนรีวิว

---

## 📁 ไฟล์ JavaScript

| ไฟล์ | คุมอะไร | เจ้าของหลัก |
|---|---|---|
| `shared.js` 🔒 | state, Supabase client, sync cloud, `showToast`, `showConfirm`, utils กลาง | **ร่วม** (Supakit เป็นหัวหน้าไฟล์) |
| `auth.js` | login overlay, login flow, session, `onAuthStateChange` | **Supakit** |
| `app-shell.js` 🔒 | `navigateToWebScreen`, sidebar / bottom-nav, header, routing `#hash` | **ร่วม** (Supakit คุม) |
| `dashboard.js` | หน้าหลัก, ปฏิทิน | เดฟใหม่ |
| `classrooms.js` | ห้องเรียนวิชาสอน | เดฟใหม่ |
| `students.js` | จัดการรายชื่อเด็ก, mapping | เดฟใหม่ |
| `timetable.js` | ตารางสอน, นำเข้าตารางสอน | เดฟใหม่ |
| `attendance.js` | เช็คชื่อ / swipe / attendance matrix | เดฟใหม่ |
| `reports.js` | รายงานวิเคราะห์ผล (weekly/term/overall) | เดฟใหม่ |
| `settings.js` | ตั้งค่าระบบ, จัดการผู้ใช้ | เดฟใหม่ |

## 🎨 ไฟล์ CSS

| ไฟล์ | คุมอะไร | เจ้าของหลัก |
|---|---|---|
| `base.css` 🔒 | ตัวแปรสี (`--primary`...), reset, layout, ปุ่ม/การ์ดร่วม | **ร่วม** (Supakit คุม) |
| `screens.css` | สไตล์เฉพาะแต่ละหน้า | **เดฟใหม่ (งานตกแต่ง)** |

## 📄 ไฟล์ HTML

| ไฟล์ | คุมอะไร | เจ้าของหลัก |
|---|---|---|
| `index.html` 🔒 | โครงทั้งแอป (คงไว้ไฟล์เดียว ไม่แยก) | **ร่วม — ทักก่อนแก้** |

---

## 🔒 ไฟล์ร่วม = ต้องทักก่อนแตะ

มีแค่ 4 ไฟล์นี้เท่านั้น:

- `shared.js`
- `app-shell.js`
- `base.css`
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
