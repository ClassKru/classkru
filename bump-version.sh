#!/bin/bash
# bump-version.sh — เพิ่มเลข ?v= ของ asset (js+css) ทุกตัวใน index.html ทีเดียว
# ใช้ทุกครั้งหลังแก้ไฟล์ js/ หรือ css/ เพื่อ bust cache (ตาม LINE OA)
#
# วิธีใช้:
#   ./bump-version.sh          # auto: อ่านเลขปัจจุบัน +1
#   ./bump-version.sh 150      # ตั้งเลขเองเป็น 150
#
# ประโยชน์: ไม่ต้องอ่าน index.html (81KB) เข้า context — ประหยัด ~20K tokens/ครั้ง

set -e
cd "$(dirname "$0")"
FILE="index.html"

CUR=$(grep -oE '\?v=[0-9]+' "$FILE" | grep -oE '[0-9]+' | sort -n | tail -1)
if [ -z "$CUR" ]; then echo "ไม่พบ ?v= ใน $FILE"; exit 1; fi

if [ -n "$1" ]; then NEW="$1"; else NEW=$((CUR + 1)); fi

# bump ทุก .js และ .css ที่มี ?v= (ทั้ง src= และ href=)
sed -i '' -E "s/(\.(js|css))\?v=[0-9]+/\1?v=$NEW/g" "$FILE"

COUNT=$(grep -cE "\.(js|css)\?v=$NEW" "$FILE")
echo "✅ bump version: $CUR → $NEW  ($COUNT refs อัปเดตแล้ว)"
