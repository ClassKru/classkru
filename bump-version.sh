#!/bin/bash
# bump-version.sh — เพิ่มเลข ?v= ของ asset (js+css) ทุกตัวใน "ทุกหน้า" ทีเดียว
# ใช้ทุกครั้งหลังแก้ไฟล์ js/ หรือ css/ เพื่อ bust cache (ตาม LINE OA)
#
# วิธีใช้:
#   ./bump-version.sh          # auto: อ่านเลขสูงสุดปัจจุบัน +1
#   ./bump-version.sh 150      # ตั้งเลขเองเป็น 150
#
# ครอบทุกไฟล์ .html ที่ราก repo (index, home, privacy, guide*, ...) — เดิม bump แค่
# index.html ทำให้ home.css/privacy.css ค้างเวอร์ชันเก่า ครูไม่เห็นการเปลี่ยนแปลง
#
# ประโยชน์: ไม่ต้องอ่าน index.html (117KB) เข้า context — ประหยัด ~30K tokens/ครั้ง

set -e
cd "$(dirname "$0")"

# ไฟล์ที่มี ?v= จริงเท่านั้น (เว้น _archive/ เพราะ glob แตะแค่รากอยู่แล้ว)
FILES=()
for f in *.html; do
  if grep -qE "\.(js|css)\?v=[0-9]+" "$f"; then FILES+=("$f"); fi
done
if [ ${#FILES[@]} -eq 0 ]; then echo "ไม่พบ ?v= ในไฟล์ .html ใด"; exit 1; fi

# เลขใหม่ = สูงสุดของทุกไฟล์ +1 (ไฟล์ที่ค้างเวอร์ชันเก่าจะถูกดึงขึ้นมาเท่ากันหมด)
CUR=$(grep -ohE "\.(js|css)\?v=[0-9]+" "${FILES[@]}" | grep -oE "[0-9]+" | sort -n | tail -1)
if [ -n "$1" ]; then NEW="$1"; else NEW=$((CUR + 1)); fi

# bump ทุก .js และ .css ที่มี ?v= (ทั้ง src= และ href=) — ไม่แตะ logo.png?v=
# macOS ใช้ BSD sed ส่วน Linux และ Git Bash ใช้ GNU sed ซึ่งรับรูปแบบ -i ต่างกัน
if sed --version >/dev/null 2>&1; then
  sed -i -E "s/(\.(js|css))\?v=[0-9]+/\1?v=$NEW/g" "${FILES[@]}"
else
  sed -i '' -E "s/(\.(js|css))\?v=[0-9]+/\1?v=$NEW/g" "${FILES[@]}"
fi

# รวมด้วย shell arithmetic เพื่อให้ใช้ได้ใน Git Bash บน Windows ซึ่งไม่มี `bc` มาให้
TOTAL=0
for f in "${FILES[@]}"; do
  COUNT=$(grep -ocE "\.(js|css)\?v=$NEW" "$f" || true)
  TOTAL=$((TOTAL + COUNT))
done
echo "✅ bump version: $CUR → $NEW  ($TOTAL refs ใน ${#FILES[@]} ไฟล์)"
for f in "${FILES[@]}"; do
  echo "   - $f ($(grep -cE "\.(js|css)\?v=$NEW" "$f") refs)"
done
