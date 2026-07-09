# ClassKru

> แอปเช็คชื่อนักเรียนสำหรับครูไทย — เช็คชื่อ จัดตารางสอน และดูรายงานการมาเรียนได้ในที่เดียว

ClassKru เป็นเว็บแอปสำหรับครู ใช้เช็คชื่อนักเรียนรายวัน จัดการห้องเรียน/ตารางสอน และสรุปสถิติการมาเรียน ข้อมูลซิงก์ขึ้นคลาวด์อัตโนมัติ ใช้งานได้ทั้งบนมือถือและคอมพิวเตอร์

## Tech Stack

| ส่วน | เทคโนโลยี |
|------|-----------|
| Frontend | HTML + CSS + JavaScript (vanilla, ไม่มี framework) |
| Backend / Database | [Supabase](https://supabase.com) (PostgreSQL + Auth + RLS) |
| Hosting / Deploy | [Vercel](https://vercel.com) |
| Font | LINE Seed Sans TH |
| Icons | [HugeIcons](https://hugeicons.com) |

## โครงสร้างไฟล์

```
classkru-app/
├── index.html          # ทุกหน้าจอของแอป (เช็คชื่อ / ตารางสอน / รายงาน / ตั้งค่า)
├── app.js              # ตรรกะทั้งหมด + การซิงก์ข้อมูลกับ Supabase
├── style.css           # ดีไซน์และ layout ทั้งแอป
├── logo.png            # โลโก้
├── clear-cache.html    # หน้าเครื่องมือล้าง cache
├── .gitignore
└── .vercelignore
```

> หมายเหตุ: ปัจจุบันโค้ดรวมอยู่ในไฟล์หลักไม่กี่ไฟล์ มีแผนจะแยกไฟล์ตามหน้าที่ (state / auth / sync / ...) ในอนาคตเพื่อให้ดูแลง่ายขึ้น

## การพัฒนาในเครื่อง (Local Development)

แอปเป็น static site ไม่ต้อง build — เปิดผ่าน local server ธรรมดาได้เลย:

```bash
# วิธีที่ 1: ใช้ Python (ติดมากับ macOS)
python3 -m http.server 8000

# วิธีที่ 2: ใช้ Node
npx serve
```

จากนั้นเปิดเบราว์เซอร์ที่ `http://localhost:8000`

> ⚠️ อย่าเปิดไฟล์ `index.html` โดยดับเบิลคลิกตรงๆ (`file://`) เพราะการล็อกอิน Supabase ต้องรันผ่าน `http://` ถึงจะทำงาน

## ข้อมูลและการซิงก์ (Data & Sync)

- ข้อมูลเก็บใน **localStorage** ของเบราว์เซอร์ก่อน แล้วซิงก์ขึ้น Supabase อัตโนมัติ
- ใช้ **อีเมลที่ล็อกอิน** เป็นกุญแจของข้อมูล → ล็อกอินเครื่องไหนก็เห็นข้อมูลเดียวกัน
- เปิด Row Level Security (RLS): ครูแต่ละคนเข้าถึงได้เฉพาะข้อมูลของอีเมลตัวเอง

## การ Deploy

Deploy อัตโนมัติผ่าน Vercel เมื่อโค้ดถูก merge เข้า `main` (อยู่ระหว่างตั้งค่า)

## ทีม

โปรเจกต์นี้อยู่ภายใต้ GitHub Organization **[ClassKru](https://github.com/ClassKru)**
สมาชิกแต่ละคนใช้บัญชี GitHub ของตัวเอง แล้วได้รับเชิญเข้า Organization (ไม่แชร์รหัสผ่าน)
