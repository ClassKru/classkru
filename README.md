# Math Wizard — Isometric 2.5D

เกมคณิตศาสตร์แนว Cute Fantasy สำหรับเล่นในเครื่อง แยกจากเกมเดิมที่ ../ และต้นแบบ Three.js ที่ ../3d/.

## เปิดเล่นในเครื่อง

1. ตรวจว่า vendor/phaser.min.js เป็น Phaser 3.90.0 ในเครื่อง
2. จากโฟลเดอร์ ClassKru รันคำสั่ง: python -m http.server 8000
3. เปิด URL: http://127.0.0.1:8000/math-wizard/isometric/

ตัวเกมใช้ไฟล์ Phaser และภาพ sprite atlas ในโฟลเดอร์นี้ทั้งหมด ไม่มี CDN, Backend, Login หรือระบบบันทึกข้อมูลถาวร

## การควบคุม

- W A S D: เดิน 8 ทิศทาง
- โจทย์แต่ละข้อมีเวลา 10 วินาที; ตอบถูก ตอบผิด หรือหมดเวลา จะขึ้นข้อใหม่ทันที
- ตอบถูกได้มานา 10 และโบนัสคอมโบเพิ่มครั้งละ 2 (สูงสุดโบนัส 10); ตอบผิดหรือหมดเวลาเสียมานาสูงสุด 8 และคอมโบรีเซ็ต
- คลิกตัวเลือกเพื่อตอบ หรือใช้ปุ่มลูกศรเลื่อนแล้วกด Enter; กด 1–4 เพื่อตอบโดยตรงได้ด้วย
- บนจอใหญ่ โจทย์และแถบเวทอยู่ในแผงข้างสนาม; บนจอแคบจะแสดงต่อใต้สนามตามแนวตั้ง
- กด E: Fireball (30 MP), R: Lightning (50 MP), T: Meteor (100 MP); คลิกปุ่มเวทได้เช่นกัน
- หลังเคลียร์ห้อง เดินเข้าใกล้ประตูเพื่อเปลี่ยนห้องอัตโนมัติ หรือคลิกปุ่มประตูเมื่อยืนใกล้ประตู
- Space: Dodge
- คลิกมอนสเตอร์เพื่อเลือกเป้าหมายเฉพาะตัว; Tab: เปลี่ยนเป้าหมาย
- Q: โจมตีด้วยไม้เท้าเมื่ออยู่ใกล้

## โครงสร้าง

- src/dungeon-scene.js: Phaser Scene และวงจรการเล่น
- src/player-controller.js, src/monster-ai.js, src/monster-factory.js: ผู้เล่นและ FSM มอนสเตอร์
- src/room-manager.js, src/room-data.js, src/isometric.js: ห้อง การชน และการฉายภาพ
- src/math-engine.js, src/spell-system.js: โจทย์ คำตอบ และเวทมนตร์
- src/ui-controller.js, src/effect-pool.js, src/audio.js: HUD, เอฟเฟกต์ที่ใช้ซ้ำ และเสียงสังเคราะห์
- assets/sprite-atlas.svg: Sprite sheet ในเครื่องสำหรับตัวละครและเอฟเฟกต์
- vendor/: Phaser 3 และไฟล์ใบอนุญาต

## ตรวจระบบ

รัน npm test --prefix math-wizard/isometric จากโฟลเดอร์ ClassKru
