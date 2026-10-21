'use strict';

(function exposeRevisionIntent(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ClassKruRevisionIntent = api;
})(typeof globalThis === 'object' ? globalThis : this, function createRevisionIntent() {
  const PATTERNS = Object.freeze({
    visual: [
      /สี|พื้นหลัง|พื้นผิว|ฟอนต์|ตัวอักษร|ขนาดตัวอักษร|ระยะห่าง|ช่องว่าง|จัดวาง|เลย์เอาต์|layout|สีสัน|สวย|มืออาชีพ|ดีไซน์|design|color|background|font|theme|contrast|spacing|typography|responsive|มุมกล้อง|มุมมอง|ซูม|zoom|camera|viewpoint|3\s*d|สามมิติ|ภาพเคลื่อนไหว|แอนิเมชัน|animation/i
    ],
    interaction: [
      /ปุ่ม|ตัวเลื่อน|slider|ลาก|ดร็อป|คลิก|เลือก|ควบคุม|โต้ตอบ|ปฏิสัมพันธ์|interaction|control|keyboard|แป้นพิมพ์|เริ่มใหม่|หยุด|เล่นต่อ|คำใบ้|feedback|ตอบกลับ/i
    ],
    pedagogical: [
      /เป้าหมายการเรียน|วัตถุประสงค์|วิธีเรียน|วิธีสอน|ประสบการณ์การเรียน|กิจกรรม|คำอธิบาย|คำถาม|แบบฝึก|เกม|เฉลย|คำตอบ|สาระ|ข้อเท็จจริง|หลักการ|เปรียบเทียบ|สำรวจ|ค้นพบ|ทำนาย|อธิบาย|สอน|เรียนรู้|ผู้เรียน|นักเรียน|เนื้อหา|แนวคิด|บทเรียน|การนำเสนอ|รูปแบบสื่อ|presentation|learning experience|learning goal|content|answer|fact|pedagog/i
    ],
    simulation: [
      /กลไก|การจำลอง|จำลอง|สูตร|คำนวณ|สมการ|ตัวแปร|ค่าที่คำนวณ|ผลการทดลอง|ผลลัพธ์|ความสัมพันธ์ระหว่าง|แรงกับการเคลื่อนที่|กฎฟิสิกส์|หน่วยวัด|simulation logic|simulation|formula|equation|calculate|physics|model behavior/i
    ]
  });

  function classifyRevisionIntent(instruction) {
    const text = typeof instruction === 'string' ? instruction.trim() : '';
    const activeText = text.split(/[,;.!?]|แต่|แล้ว|\s+but\s+|\s+and\s+/i)
      .filter(clause => !/(?:คง|รักษา|ไม่เปลี่ยน|เหมือนเดิม|preserve|keep unchanged)/i.test(clause))
      .join(' ');
    const areas = Object.keys(PATTERNS).filter(area => PATTERNS[area].some(pattern => pattern.test(activeText)));
    const category = areas.length > 1 ? 'mixed' : areas[0] || 'contextual';
    const presentationChange = /3\s*d|สามมิติ|ภาพเคลื่อนไหว|แอนิเมชัน|animation|รูปแบบสื่อ|การนำเสนอ|presentation/i.test(activeText);
    const requiresArchitect = presentationChange || areas.some(area => ['interaction', 'pedagogical', 'simulation'].includes(area));
    const requiresConfirmation = category === 'contextual' || areas.includes('pedagogical') || areas.includes('simulation');
    return Object.freeze({
      category,
      areas: Object.freeze(areas),
      requires_architect: requiresArchitect,
      requires_confirmation: requiresConfirmation,
      clarification_required: category === 'contextual',
      presentation_change: presentationChange
    });
  }

  return Object.freeze({ classifyRevisionIntent });
});


