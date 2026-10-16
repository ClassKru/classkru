# Google Login production settings

ตั้งค่าใน Supabase Dashboard ของโปรเจกต์ ClassKru ที่ `Authentication > URL Configuration`:

- **Site URL:** `https://www.classkru.com`
- **Redirect URLs:** `https://www.classkru.com/index.html`
- เพิ่ม `https://classkru.com/index.html` ด้วย หากยังเปิดให้เข้าโดเมนแบบไม่มี `www`
- สำหรับทดสอบในเครื่อง ให้เพิ่ม `http://localhost:8000/index.html` ตาม port ที่ใช้จริง

อย่าใช้ `https://www.classkru.com/` เป็น OAuth callback เพราะ Vercel ตั้งค่า root ให้ไป `home.html` ซึ่งไม่มี Supabase client สำหรับรับ OAuth session.

Google OAuth ของ Supabase ยังใช้ callback ของ Supabase ตามเดิม ไม่ใช่ URL ของเว็บ ClassKru:

`https://dzntiiuyqvkaxqpqzxeh.supabase.co/auth/v1/callback`
