# คู่มือการทำงานร่วมกัน — ClassKru

เอกสารนี้อธิบายวิธีทำงานร่วมกันในทีม ClassKru ทุกคนในทีม**ควรอ่านและทำตาม** เพื่อไม่ให้งานชนกันและ production ไม่ล่ม

---

## 🔑 บัญชีที่ใช้ (สำคัญ)

| บัญชี | ใช้ทำอะไร |
|------|-----------|
| **GitHub account ส่วนตัวของแต่ละคน** | เขียนโค้ด / push / เปิด PR ในงานประจำวัน — commit จะติดชื่อคนทำ |
| `classkru-dev` (บัญชีบริษัท) | เจ้าของ Organization / Vercel / Supabase เท่านั้น **ไม่ใช้เขียนโค้ดประจำวัน** |

> ห้ามแชร์รหัสผ่านกัน — แต่ละคนใช้บัญชี GitHub ของตัวเอง แล้วได้รับเชิญเข้า Organization `ClassKru`

---

## 🌿 โครงสร้าง Branch (Git Flow)

```
main        ← โค้ดที่อยู่บน production จริง (https://classkru-kohl.vercel.app)
  ↑ merge ผ่าน PR เมื่อพร้อมปล่อย
develop     ← ที่รวมงานทุกคนก่อนขึ้น production
  ↑ merge ผ่าน PR
feature/*   ← แตกไปทำแต่ละฟีเจอร์ (เช่น feature/login-google)
hotfix/*    ← แก้บั๊กด่วนบน production
```

---

## ⛔ กฎเหล็กของทีม (ข้อตกลงร่วมกัน)

> **ห้าม push ตรงเข้า `main` เด็ดขาด — ต้องผ่าน Pull Request เสมอ**

เพราะเราใช้ GitHub แพลนฟรี ระบบจึง**ยังไม่ได้บังคับ**กฎนี้ให้อัตโนมัติ → ทุกคนต้อง**รักษาวินัยด้วยตัวเอง** (เมื่อทีมโตหรือมีรายได้ จะอัปเป็น GitHub Team เพื่อบังคับกฎนี้จริง)

---

## 🔄 ขั้นตอนทำงานประจำวัน

```bash
# 1. อัปเดต develop ให้ล่าสุดก่อนเริ่มงาน
git switch develop
git pull

# 2. แตก branch ใหม่สำหรับงานที่จะทำ
git switch -c feature/ชื่องาน

# 3. เขียนโค้ด แล้วบันทึก (ทำซ้ำได้เรื่อยๆ)
git add .
git commit -m "อธิบายสิ่งที่ทำ"

# 4. ส่งขึ้น GitHub
git push -u origin feature/ชื่องาน

# 5. เปิด Pull Request (บนเว็บ GitHub หรือ `gh pr create`)
#    → Vercel จะสร้าง Preview URL ให้อัตโนมัติในหน้า PR
#    → ให้เพื่อนในทีมช่วยดู/รีวิวก่อน

# 6. Merge PR → Vercel deploy ขึ้น production ให้เองอัตโนมัติ

# 7. ลบ branch ที่ใช้เสร็จแล้ว (กด Delete branch ในหน้า PR)
```

---

## ✍️ ธรรมเนียมการเขียน commit

ขึ้นต้นด้วยคำกริยาภาษาอังกฤษ + อธิบายสั้นๆ:

- `Add ...` — เพิ่มของใหม่
- `Fix ...` — แก้บั๊ก
- `Update ...` — ปรับของเดิม
- `Remove ...` — ลบออก

---

## 🚀 การ Deploy

**ไม่ต้องสั่ง deploy เอง** — เมื่อโค้ด merge เข้า `main` แล้ว Vercel จะ deploy ขึ้น production ให้อัตโนมัติ

- **Production:** https://classkru-kohl.vercel.app (จาก branch `main`)
- **Preview:** ทุก PR จะได้ URL ทดลองแยกของตัวเอง (เฉพาะคนในทีมที่ล็อกอิน Vercel เปิดดูได้)

---

## 💻 รันโปรเจกต์ในเครื่อง (Local Dev)

```bash
git clone https://github.com/ClassKru/classkru.git
cd classkru
python3 -m http.server 8000   # หรือ npx serve
```
เปิด `http://localhost:8000` (อย่าเปิดไฟล์แบบ `file://` เพราะ login Supabase จะไม่ทำงาน)

---

## ⚠️ ข้อควรระวังเฉพาะโปรเจกต์

- **Cache busting:** เมื่อแก้ `style.css` หรือ `app.js` ต้อง **bump เลขเวอร์ชัน** ที่ `index.html` (`style.css?v=N` และ `app.js?v=N` ให้ตรงกัน) ทุกครั้ง ไม่งั้นผู้ใช้จะเห็นโค้ดเก่าที่ค้างใน cache
- **ข้อมูลอยู่ Supabase** ไม่อยู่ใน Git — อย่า commit ไฟล์ข้อมูล/ความลับใดๆ
