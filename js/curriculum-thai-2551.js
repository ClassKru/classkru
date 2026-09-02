/**
 * Generated from the official OBEC indicator tables.
 * Run tools-import-indicator-book.js to regenerate.
 */
(function () {
  'use strict';

  const source = {"id":"TH-BEC-2551-THAI-2551","title":"ตัวชี้วัดและสาระการเรียนรู้แกนกลาง กลุ่มสาระการเรียนรู้ภาษาไทย","framework":"หลักสูตรแกนกลางการศึกษาขั้นพื้นฐาน พ.ศ. 2551","revisionYear":2551,"publisher":"สำนักงานคณะกรรมการการศึกษาขั้นพื้นฐาน","url":"https://www.academic.obec.go.th/web/news/view/75","retrievedAt":"2026-09-02","scope":"มัธยมศึกษาตอนต้น ม.1-ม.3"};
  const standards = [
  {
    "id": "TH1.1",
    "code": "ท 1.1",
    "title": "ใช้กระบวนการอ่านสร้างความรู้และความคิดเพื่อนำไปใช้ตัดสินใจ แก้ปัญหาในการดำเนินชีวิต และมีนิสัยรักการอ่าน",
    "strand": "การอ่าน"
  },
  {
    "id": "TH5.1",
    "code": "ท 5.1",
    "title": "เข้าใจและแสดงความคิดเห็น วิจารณ์วรรณคดีและวรรณกรรมไทยอย่างเห็นคุณค่าและนำมา ประยุกต์ใช้ในชีวิตจริง",
    "strand": "วรรณคดีและวรรณกรรม"
  },
  {
    "id": "TH2.1",
    "code": "ท 2.1",
    "title": "ใช้กระบวนการเขียนสื่อสาร เขียนเรียงความ ย่อความ และเขียนเรื่องราวในรูปแบบต่าง ๆ เขียนรายงานข้อมูลสารสนเทศและรายงานการศึกษาค้นคว้าอย่างมีประสิทธิภาพ",
    "strand": "การเขียน"
  },
  {
    "id": "TH4.1",
    "code": "ท 4.1",
    "title": "เข้าใจธรรมชาติของภาษาและหลักภาษาไทย การเปลี่ยนแปลงของภาษาและพลังของภาษา ภูมิปัญญาทางภาษา และรักษาภาษาไทยไว้เป็นสมบัติของชาติ",
    "strand": "หลักการใช้ภาษาไทย"
  },
  {
    "id": "TH3.1",
    "code": "ท 3.1",
    "title": "สามารถเลือกฟังและดูอย่างมีวิจารณญาณ และพูดแสดงความรู้ ความคิด และความรู้สึก ในโอกาสต่าง ๆ อย่างมีวิจารณญาณและสร้างสรรค์",
    "strand": "การฟัง การดู และการพูด"
  }
];
  const units = [
  {
    "id": "m1-th1-1",
    "grade": "M1",
    "title": "การอ่าน",
    "description": "ใช้กระบวนการอ่านสร้างความรู้และความคิดเพื่อนำไปใช้ตัดสินใจ แก้ปัญหาในการดำเนินชีวิต และมีนิสัยรักการอ่าน"
  },
  {
    "id": "m1-th5-1",
    "grade": "M1",
    "title": "วรรณคดีและวรรณกรรม",
    "description": "เข้าใจและแสดงความคิดเห็น วิจารณ์วรรณคดีและวรรณกรรมไทยอย่างเห็นคุณค่าและนำมา ประยุกต์ใช้ในชีวิตจริง"
  },
  {
    "id": "m1-th2-1",
    "grade": "M1",
    "title": "การเขียน",
    "description": "ใช้กระบวนการเขียนสื่อสาร เขียนเรียงความ ย่อความ และเขียนเรื่องราวในรูปแบบต่าง ๆ เขียนรายงานข้อมูลสารสนเทศและรายงานการศึกษาค้นคว้าอย่างมีประสิทธิภาพ"
  },
  {
    "id": "m1-th4-1",
    "grade": "M1",
    "title": "หลักการใช้ภาษาไทย",
    "description": "เข้าใจธรรมชาติของภาษาและหลักภาษาไทย การเปลี่ยนแปลงของภาษาและพลังของภาษา ภูมิปัญญาทางภาษา และรักษาภาษาไทยไว้เป็นสมบัติของชาติ"
  },
  {
    "id": "m1-th3-1",
    "grade": "M1",
    "title": "การฟัง การดู และการพูด",
    "description": "สามารถเลือกฟังและดูอย่างมีวิจารณญาณ และพูดแสดงความรู้ ความคิด และความรู้สึก ในโอกาสต่าง ๆ อย่างมีวิจารณญาณและสร้างสรรค์"
  },
  {
    "id": "m2-th1-1",
    "grade": "M2",
    "title": "การอ่าน",
    "description": "ใช้กระบวนการอ่านสร้างความรู้และความคิดเพื่อนำไปใช้ตัดสินใจ แก้ปัญหาในการดำเนินชีวิต และมีนิสัยรักการอ่าน"
  },
  {
    "id": "m2-th5-1",
    "grade": "M2",
    "title": "วรรณคดีและวรรณกรรม",
    "description": "เข้าใจและแสดงความคิดเห็น วิจารณ์วรรณคดีและวรรณกรรมไทยอย่างเห็นคุณค่าและนำมา ประยุกต์ใช้ในชีวิตจริง"
  },
  {
    "id": "m2-th2-1",
    "grade": "M2",
    "title": "การเขียน",
    "description": "ใช้กระบวนการเขียนสื่อสาร เขียนเรียงความ ย่อความ และเขียนเรื่องราวในรูปแบบต่าง ๆ เขียนรายงานข้อมูลสารสนเทศและรายงานการศึกษาค้นคว้าอย่างมีประสิทธิภาพ"
  },
  {
    "id": "m2-th4-1",
    "grade": "M2",
    "title": "หลักการใช้ภาษาไทย",
    "description": "เข้าใจธรรมชาติของภาษาและหลักภาษาไทย การเปลี่ยนแปลงของภาษาและพลังของภาษา ภูมิปัญญาทางภาษา และรักษาภาษาไทยไว้เป็นสมบัติของชาติ"
  },
  {
    "id": "m2-th3-1",
    "grade": "M2",
    "title": "การฟัง การดู และการพูด",
    "description": "สามารถเลือกฟังและดูอย่างมีวิจารณญาณ และพูดแสดงความรู้ ความคิด และความรู้สึก ในโอกาสต่าง ๆ อย่างมีวิจารณญาณและสร้างสรรค์"
  },
  {
    "id": "m3-th1-1",
    "grade": "M3",
    "title": "การอ่าน",
    "description": "ใช้กระบวนการอ่านสร้างความรู้และความคิดเพื่อนำไปใช้ตัดสินใจ แก้ปัญหาในการดำเนินชีวิต และมีนิสัยรักการอ่าน"
  },
  {
    "id": "m3-th5-1",
    "grade": "M3",
    "title": "วรรณคดีและวรรณกรรม",
    "description": "เข้าใจและแสดงความคิดเห็น วิจารณ์วรรณคดีและวรรณกรรมไทยอย่างเห็นคุณค่าและนำมา ประยุกต์ใช้ในชีวิตจริง"
  },
  {
    "id": "m3-th2-1",
    "grade": "M3",
    "title": "การเขียน",
    "description": "ใช้กระบวนการเขียนสื่อสาร เขียนเรียงความ ย่อความ และเขียนเรื่องราวในรูปแบบต่าง ๆ เขียนรายงานข้อมูลสารสนเทศและรายงานการศึกษาค้นคว้าอย่างมีประสิทธิภาพ"
  },
  {
    "id": "m3-th4-1",
    "grade": "M3",
    "title": "หลักการใช้ภาษาไทย",
    "description": "เข้าใจธรรมชาติของภาษาและหลักภาษาไทย การเปลี่ยนแปลงของภาษาและพลังของภาษา ภูมิปัญญาทางภาษา และรักษาภาษาไทยไว้เป็นสมบัติของชาติ"
  },
  {
    "id": "m3-th3-1",
    "grade": "M3",
    "title": "การฟัง การดู และการพูด",
    "description": "สามารถเลือกฟังและดูอย่างมีวิจารณญาณ และพูดแสดงความรู้ ความคิด และความรู้สึก ในโอกาสต่าง ๆ อย่างมีวิจารณญาณและสร้างสรรค์"
  }
];
  const indicators = [
  {
    "id": "TH2551-11-M1-1",
    "code": "ท 1.1 ม.1/1",
    "standard": "TH1.1",
    "grade": "M1",
    "unitId": "m1-th1-1",
    "text": "อ่านออกเสียงบทร้อยแก้วและบทร้อยกรองได้ ถูกต้องเหมาะสมกับเรื่องที่อ่าน",
    "sourcePage": 19,
    "sourcePdfPage": 19
  },
  {
    "id": "TH2551-11-M1-2",
    "code": "ท 1.1 ม.1/2",
    "standard": "TH1.1",
    "grade": "M1",
    "unitId": "m1-th1-1",
    "text": "จับใจความสำคัญ จากเรื่องที่อ่าน",
    "sourcePage": 19,
    "sourcePdfPage": 19
  },
  {
    "id": "TH2551-11-M1-3",
    "code": "ท 1.1 ม.1/3",
    "standard": "TH1.1",
    "grade": "M1",
    "unitId": "m1-th1-1",
    "text": "ระบุเหตุและผลและข้อเท็จจริงกับข้อคิดเห็น จากเรื่องที่อ่าน",
    "sourcePage": 19,
    "sourcePdfPage": 19
  },
  {
    "id": "TH2551-11-M1-6",
    "code": "ท 1.1 ม.1/6",
    "standard": "TH1.1",
    "grade": "M1",
    "unitId": "m1-th1-1",
    "text": "ระบุข้อสังเกตและความสมเหตุสมผลของงาน เขียนประเภทชักจูงโน้มน้าวใจ",
    "sourcePage": 19,
    "sourcePdfPage": 19
  },
  {
    "id": "TH2551-11-M1-7",
    "code": "ท 1.1 ม.1/7",
    "standard": "TH1.1",
    "grade": "M1",
    "unitId": "m1-th1-1",
    "text": "ปฏิบัติตามคู่มือแนะนำวิธีการใช้งานของ เครื่องมือหรือเครื่องใช้ในระดับที่ยากขึ้น",
    "sourcePage": 19,
    "sourcePdfPage": 19
  },
  {
    "id": "TH2551-11-M1-9",
    "code": "ท 1.1 ม.1/9",
    "standard": "TH1.1",
    "grade": "M1",
    "unitId": "m1-th1-1",
    "text": "มีมารยาทในการอ่าน",
    "sourcePage": 19,
    "sourcePdfPage": 19
  },
  {
    "id": "TH2551-11-M1-5",
    "code": "ท 1.1 ม.1/5",
    "standard": "TH1.1",
    "grade": "M1",
    "unitId": "m1-th1-1",
    "text": "ตีความคำยากในเอกสารวิชาการ โดยพิจารณา จากบริบท",
    "sourcePage": 19,
    "sourcePdfPage": 19
  },
  {
    "id": "TH2551-11-M1-4",
    "code": "ท 1.1 ม.1/4",
    "standard": "TH1.1",
    "grade": "M1",
    "unitId": "m1-th1-1",
    "text": "ระบุและอธิบายคำ เปรียบเทียบและคำที่มีหลาย ความหมายในบริบทต่าง ๆ จากการอ่าน",
    "sourcePage": 19,
    "sourcePdfPage": 19
  },
  {
    "id": "TH2551-51-M1-1",
    "code": "ท 5.1 ม.1/1",
    "standard": "TH5.1",
    "grade": "M1",
    "unitId": "m1-th5-1",
    "text": "สรุปเนื้อหาวรรณคดี และวรรณกรรมที่อ่าน",
    "sourcePage": 19,
    "sourcePdfPage": 19
  },
  {
    "id": "TH2551-11-M1-8",
    "code": "ท 1.1 ม.1/8",
    "standard": "TH1.1",
    "grade": "M1",
    "unitId": "m1-th1-1",
    "text": "วิเคราะห์คุณค่าที่ ได้รับจากการอ่านงานเขียนอย่าง หลากหลายเพื่อนำไปใช้แก้ปัญหา ในชีวิต",
    "sourcePage": 19,
    "sourcePdfPage": 19
  },
  {
    "id": "TH2551-51-M1-2",
    "code": "ท 5.1 ม.1/2",
    "standard": "TH5.1",
    "grade": "M1",
    "unitId": "m1-th5-1",
    "text": "วิเคราะห์วรรณคดีและวรรณกรรมที่อ่านพร้อม ยกเหตุผลประกอบ",
    "sourcePage": 19,
    "sourcePdfPage": 19
  },
  {
    "id": "TH2551-51-M1-3",
    "code": "ท 5.1 ม.1/3",
    "standard": "TH5.1",
    "grade": "M1",
    "unitId": "m1-th5-1",
    "text": "อธิบายคุณค่าของวรรณคดีและวรรณกรรมที่อ่าน",
    "sourcePage": 19,
    "sourcePdfPage": 19
  },
  {
    "id": "TH2551-51-M1-4",
    "code": "ท 5.1 ม.1/4",
    "standard": "TH5.1",
    "grade": "M1",
    "unitId": "m1-th5-1",
    "text": "สรุปความรู้และข้อคิดจากการอ่านเพื่อประยุกต์ ใช้ในชีวิตจริง",
    "sourcePage": 19,
    "sourcePdfPage": 19
  },
  {
    "id": "TH2551-21-M1-1",
    "code": "ท 2.1 ม.1/1",
    "standard": "TH2.1",
    "grade": "M1",
    "unitId": "m1-th2-1",
    "text": "คัดลายมือตัวบรรจงครึ่งบรรทัด",
    "sourcePage": 20,
    "sourcePdfPage": 20
  },
  {
    "id": "TH2551-21-M1-2",
    "code": "ท 2.1 ม.1/2",
    "standard": "TH2.1",
    "grade": "M1",
    "unitId": "m1-th2-1",
    "text": "เขียนสื่อสารโดยใช้ ถ้อยคำถูกต้อง ชัดเจน เหมาะสม และสละสลวย",
    "sourcePage": 20,
    "sourcePdfPage": 20
  },
  {
    "id": "TH2551-21-M1-3",
    "code": "ท 2.1 ม.1/3",
    "standard": "TH2.1",
    "grade": "M1",
    "unitId": "m1-th2-1",
    "text": "เขียนบรรยายประสบการณ์โดยระบุสาระสำคัญ และรายละเอียดสนับสนุน",
    "sourcePage": 20,
    "sourcePdfPage": 20
  },
  {
    "id": "TH2551-21-M1-4",
    "code": "ท 2.1 ม.1/4",
    "standard": "TH2.1",
    "grade": "M1",
    "unitId": "m1-th2-1",
    "text": "เขียนเรียงความ",
    "sourcePage": 20,
    "sourcePdfPage": 20
  },
  {
    "id": "TH2551-21-M1-5",
    "code": "ท 2.1 ม.1/5",
    "standard": "TH2.1",
    "grade": "M1",
    "unitId": "m1-th2-1",
    "text": "เขียนย่อความจากเรื่องที่อ่าน",
    "sourcePage": 20,
    "sourcePdfPage": 20
  },
  {
    "id": "TH2551-21-M1-6",
    "code": "ท 2.1 ม.1/6",
    "standard": "TH2.1",
    "grade": "M1",
    "unitId": "m1-th2-1",
    "text": "เขียนแสดงความคิดเห็นเกี่ยวกับสาระจากสื่อ ที่ได้รับ",
    "sourcePage": 20,
    "sourcePdfPage": 20
  },
  {
    "id": "TH2551-21-M1-7",
    "code": "ท 2.1 ม.1/7",
    "standard": "TH2.1",
    "grade": "M1",
    "unitId": "m1-th2-1",
    "text": "เขียนจดหมายส่วนตัวและจดหมายกิจธุระ",
    "sourcePage": 20,
    "sourcePdfPage": 20
  },
  {
    "id": "TH2551-21-M1-8",
    "code": "ท 2.1 ม.1/8",
    "standard": "TH2.1",
    "grade": "M1",
    "unitId": "m1-th2-1",
    "text": "เขียนรายงานการศึกษาค้นคว้าและโครงงาน",
    "sourcePage": 20,
    "sourcePdfPage": 20
  },
  {
    "id": "TH2551-21-M1-9",
    "code": "ท 2.1 ม.1/9",
    "standard": "TH2.1",
    "grade": "M1",
    "unitId": "m1-th2-1",
    "text": "มีมารยาทในการเขียน",
    "sourcePage": 20,
    "sourcePdfPage": 20
  },
  {
    "id": "TH2551-41-M1-5",
    "code": "ท 4.1 ม.1/5",
    "standard": "TH4.1",
    "grade": "M1",
    "unitId": "m1-th4-1",
    "text": "แต่งบทร้อยกรอง",
    "sourcePage": 20,
    "sourcePdfPage": 20
  },
  {
    "id": "TH2551-31-M1-2",
    "code": "ท 3.1 ม.1/2",
    "standard": "TH3.1",
    "grade": "M1",
    "unitId": "m1-th3-1",
    "text": "เล่าเรื่องย่อจากเรื่องที่ฟังและดู",
    "sourcePage": 20,
    "sourcePdfPage": 20
  },
  {
    "id": "TH2551-31-M1-1",
    "code": "ท 3.1 ม.1/1",
    "standard": "TH3.1",
    "grade": "M1",
    "unitId": "m1-th3-1",
    "text": "พูดสรุปใจความสำคัญ ของเรื่องที่ฟังและดู",
    "sourcePage": 20,
    "sourcePdfPage": 20
  },
  {
    "id": "TH2551-31-M1-3",
    "code": "ท 3.1 ม.1/3",
    "standard": "TH3.1",
    "grade": "M1",
    "unitId": "m1-th3-1",
    "text": "พูดแสดงความคิดเห็นอย่างสร้างสรรค์เกี่ยวกับ เรื่องที่ฟังและดู",
    "sourcePage": 20,
    "sourcePdfPage": 20
  },
  {
    "id": "TH2551-31-M1-5",
    "code": "ท 3.1 ม.1/5",
    "standard": "TH3.1",
    "grade": "M1",
    "unitId": "m1-th3-1",
    "text": "พูดรายงานเรื่อง หรือประเด็นที่ศึกษาค้นคว้าจาก",
    "sourcePage": 20,
    "sourcePdfPage": 20
  },
  {
    "id": "TH2551-31-M1-6",
    "code": "ท 3.1 ม.1/6",
    "standard": "TH3.1",
    "grade": "M1",
    "unitId": "m1-th3-1",
    "text": "มีมารยาทในการฟัง การดู และการพูด การฟัง การดู และการสนทนา 7",
    "sourcePage": 20,
    "sourcePdfPage": 20
  },
  {
    "id": "TH2551-31-M1-4",
    "code": "ท 3.1 ม.1/4",
    "standard": "TH3.1",
    "grade": "M1",
    "unitId": "m1-th3-1",
    "text": "ประเมินความ น่าเชื่อถือของสื่อที่มีเนื้อหาโน้มน้าวใจ",
    "sourcePage": 20,
    "sourcePdfPage": 20
  },
  {
    "id": "TH2551-41-M1-1",
    "code": "ท 4.1 ม.1/1",
    "standard": "TH4.1",
    "grade": "M1",
    "unitId": "m1-th4-1",
    "text": "อธิบายลักษณะของเสียงในภาษาไทย",
    "sourcePage": 21,
    "sourcePdfPage": 21
  },
  {
    "id": "TH2551-41-M1-3",
    "code": "ท 4.1 ม.1/3",
    "standard": "TH4.1",
    "grade": "M1",
    "unitId": "m1-th4-1",
    "text": "วิเคราะห์ชนิดและ",
    "sourcePage": 21,
    "sourcePdfPage": 21
  },
  {
    "id": "TH2551-41-M1-2",
    "code": "ท 4.1 ม.1/2",
    "standard": "TH4.1",
    "grade": "M1",
    "unitId": "m1-th4-1",
    "text": "สร้างคำในภาษาไทย หน้าที่ของคำในประโยค 9",
    "sourcePage": 21,
    "sourcePdfPage": 21
  },
  {
    "id": "TH2551-41-M1-4",
    "code": "ท 4.1 ม.1/4",
    "standard": "TH4.1",
    "grade": "M1",
    "unitId": "m1-th4-1",
    "text": "วิเคราะห์ความ แตกต่างของภาษาพูดและภาษา เขียน 10",
    "sourcePage": 21,
    "sourcePdfPage": 21
  },
  {
    "id": "TH2551-41-M1-6",
    "code": "ท 4.1 ม.1/6",
    "standard": "TH4.1",
    "grade": "M1",
    "unitId": "m1-th4-1",
    "text": "จำแนกและใช้ สำนวนที่เป็นคำพังเพยและสุภาษิต",
    "sourcePage": 21,
    "sourcePdfPage": 21
  },
  {
    "id": "TH2551-51-M1-5",
    "code": "ท 5.1 ม.1/5",
    "standard": "TH5.1",
    "grade": "M1",
    "unitId": "m1-th5-1",
    "text": "ท่องจำบทอาขยาน ตามที่กำหนดและบทร้อยกรองที่มี คุณค่าตามความสนใจ",
    "sourcePage": 21,
    "sourcePdfPage": 21
  },
  {
    "id": "TH2551-11-M2-1",
    "code": "ท 1.1 ม.2/1",
    "standard": "TH1.1",
    "grade": "M2",
    "unitId": "m2-th1-1",
    "text": "อ่านออกเสียงบทร้อยแก้วและบทร้อยกรองได้ ถูกต้องเหมาะสมกับเรื่องที่อ่าน",
    "sourcePage": 22,
    "sourcePdfPage": 22
  },
  {
    "id": "TH2551-11-M2-7",
    "code": "ท 1.1 ม.2/7",
    "standard": "TH1.1",
    "grade": "M2",
    "unitId": "m2-th1-1",
    "text": "อ่านหนังสือ บทความหรือคำประพันธ์อย่าง หลากหลาย และประเมินคุณค่า หรือแนวคิดที่ได้จากการอ่านเพื่อ นำไปใช้แก้ปัญหาในชีวิต",
    "sourcePage": 22,
    "sourcePdfPage": 22
  },
  {
    "id": "TH2551-11-M2-2",
    "code": "ท 1.1 ม.2/2",
    "standard": "TH1.1",
    "grade": "M2",
    "unitId": "m2-th1-1",
    "text": "จับใจความสำคัญ สรุปความและอธิบาย รายละเอียดจากเรื่องที่อ่าน",
    "sourcePage": 22,
    "sourcePdfPage": 22
  },
  {
    "id": "TH2551-11-M2-3",
    "code": "ท 1.1 ม.2/3",
    "standard": "TH1.1",
    "grade": "M2",
    "unitId": "m2-th1-1",
    "text": "เขียนผังความคิดเพื่อแสดงความเข้าใจใน บทเรียนต่าง ๆ ที่อ่าน",
    "sourcePage": 22,
    "sourcePdfPage": 22
  },
  {
    "id": "TH2551-11-M2-8",
    "code": "ท 1.1 ม.2/8",
    "standard": "TH1.1",
    "grade": "M2",
    "unitId": "m2-th1-1",
    "text": "มีมารยาทในการอ่าน",
    "sourcePage": 22,
    "sourcePdfPage": 22
  },
  {
    "id": "TH2551-41-M2-5",
    "code": "ท 4.1 ม.2/5",
    "standard": "TH4.1",
    "grade": "M2",
    "unitId": "m2-th4-1",
    "text": "รวบรวม และอธิบายความหมายของคำ ภาษาต่างประเทศที่ใช้ในภาษาไทย",
    "sourcePage": 22,
    "sourcePdfPage": 22
  },
  {
    "id": "TH2551-11-M2-4",
    "code": "ท 1.1 ม.2/4",
    "standard": "TH1.1",
    "grade": "M2",
    "unitId": "m2-th1-1",
    "text": "อภิปรายแสดงความคิดเห็น และข้อโต้แย้ง เกี่ยวกับเรื่องที่อ่าน",
    "sourcePage": 22,
    "sourcePdfPage": 22
  },
  {
    "id": "TH2551-11-M2-5",
    "code": "ท 1.1 ม.2/5",
    "standard": "TH1.1",
    "grade": "M2",
    "unitId": "m2-th1-1",
    "text": "วิเคราะห์และจำแนก ข้อเท็จจริง ข้อมูลสนับสนุน และ ข้อคิดเห็นจากบทความที่อ่าน",
    "sourcePage": 22,
    "sourcePdfPage": 22
  },
  {
    "id": "TH2551-51-M2-4",
    "code": "ท 5.1 ม.2/4",
    "standard": "TH5.1",
    "grade": "M2",
    "unitId": "m2-th5-1",
    "text": "สรุปความรู้และ ข้อคิดจากการอ่านไปประยุกต์ใช้ ในชีวิตประจำวัน",
    "sourcePage": 22,
    "sourcePdfPage": 22
  },
  {
    "id": "TH2551-11-M2-6",
    "code": "ท 1.1 ม.2/6",
    "standard": "TH1.1",
    "grade": "M2",
    "unitId": "m2-th1-1",
    "text": "ระบุข้อสังเกตการชวนเชื่อ การโน้มน้าว หรือ ความสมเหตุสมผลของงานเขียน",
    "sourcePage": 22,
    "sourcePdfPage": 22
  },
  {
    "id": "TH2551-51-M2-1",
    "code": "ท 5.1 ม.2/1",
    "standard": "TH5.1",
    "grade": "M2",
    "unitId": "m2-th5-1",
    "text": "สรุปเนื้อหาวรรณคดีและวรรณกรรมที่อ่าน ในระดับที่ยากขึ้น",
    "sourcePage": 22,
    "sourcePdfPage": 22
  },
  {
    "id": "TH2551-51-M2-2",
    "code": "ท 5.1 ม.2/2",
    "standard": "TH5.1",
    "grade": "M2",
    "unitId": "m2-th5-1",
    "text": "วิเคราะห์และวิจารณ์วรรณคดี วรรณกรรม และวรรณกรรมท้องถิ่นที่อ่านพร้อมยกเหตุผลประกอบ",
    "sourcePage": 22,
    "sourcePdfPage": 22
  },
  {
    "id": "TH2551-51-M2-3",
    "code": "ท 5.1 ม.2/3",
    "standard": "TH5.1",
    "grade": "M2",
    "unitId": "m2-th5-1",
    "text": "อธิบายคุณค่าของวรรณคดีและวรรณกรรมที่อ่าน",
    "sourcePage": 22,
    "sourcePdfPage": 22
  },
  {
    "id": "TH2551-21-M2-1",
    "code": "ท 2.1 ม.2/1",
    "standard": "TH2.1",
    "grade": "M2",
    "unitId": "m2-th2-1",
    "text": "คัดลายมือตัวบรรจงครึ่งบรรทัด",
    "sourcePage": 23,
    "sourcePdfPage": 23
  },
  {
    "id": "TH2551-21-M2-2",
    "code": "ท 2.1 ม.2/2",
    "standard": "TH2.1",
    "grade": "M2",
    "unitId": "m2-th2-1",
    "text": "เขียนบรรยาย และ",
    "sourcePage": 23,
    "sourcePdfPage": 23
  },
  {
    "id": "TH2551-21-M2-3",
    "code": "ท 2.1 ม.2/3",
    "standard": "TH2.1",
    "grade": "M2",
    "unitId": "m2-th2-1",
    "text": "เขียนเรียงความ พรรณนา",
    "sourcePage": 23,
    "sourcePdfPage": 23
  },
  {
    "id": "TH2551-21-M2-4",
    "code": "ท 2.1 ม.2/4",
    "standard": "TH2.1",
    "grade": "M2",
    "unitId": "m2-th2-1",
    "text": "เขียนย่อความ",
    "sourcePage": 23,
    "sourcePdfPage": 23
  },
  {
    "id": "TH2551-21-M2-5",
    "code": "ท 2.1 ม.2/5",
    "standard": "TH2.1",
    "grade": "M2",
    "unitId": "m2-th2-1",
    "text": "เขียนรายงานการศึกษาค้นคว้า",
    "sourcePage": 23,
    "sourcePdfPage": 23
  },
  {
    "id": "TH2551-21-M2-6",
    "code": "ท 2.1 ม.2/6",
    "standard": "TH2.1",
    "grade": "M2",
    "unitId": "m2-th2-1",
    "text": "เขียนจดหมายกิจธุระ",
    "sourcePage": 23,
    "sourcePdfPage": 23
  },
  {
    "id": "TH2551-21-M2-7",
    "code": "ท 2.1 ม.2/7",
    "standard": "TH2.1",
    "grade": "M2",
    "unitId": "m2-th2-1",
    "text": "เขียนวิเคราะห์ วิจารณ์และแสดงความรู้ ความคิดเห็น หรือโต้แย้งในเรื่องที่อ่านอย่างมีเหตุผล",
    "sourcePage": 23,
    "sourcePdfPage": 23
  },
  {
    "id": "TH2551-21-M2-8",
    "code": "ท 2.1 ม.2/8",
    "standard": "TH2.1",
    "grade": "M2",
    "unitId": "m2-th2-1",
    "text": "มีมารยาทในการเขียน",
    "sourcePage": 23,
    "sourcePdfPage": 23
  },
  {
    "id": "TH2551-41-M2-3",
    "code": "ท 4.1 ม.2/3",
    "standard": "TH4.1",
    "grade": "M2",
    "unitId": "m2-th4-1",
    "text": "แต่งบทร้อยกรอง",
    "sourcePage": 23,
    "sourcePdfPage": 23
  },
  {
    "id": "TH2551-31-M2-1",
    "code": "ท 3.1 ม.2/1",
    "standard": "TH3.1",
    "grade": "M2",
    "unitId": "m2-th3-1",
    "text": "พูดสรุปใจความสำคัญ ของเรื่องที่ฟังและดู",
    "sourcePage": 23,
    "sourcePdfPage": 23
  },
  {
    "id": "TH2551-31-M2-3",
    "code": "ท 3.1 ม.2/3",
    "standard": "TH3.1",
    "grade": "M2",
    "unitId": "m2-th3-1",
    "text": "วิเคราะห์และ วิจารณ์เรื่องที่ฟัง และดูอย่างมีเหตุผล เพื่อนำข้อคิดมาประยุกต์ใช้ใน การดำเนินชีวิต",
    "sourcePage": 23,
    "sourcePdfPage": 23
  },
  {
    "id": "TH2551-31-M2-2",
    "code": "ท 3.1 ม.2/2",
    "standard": "TH3.1",
    "grade": "M2",
    "unitId": "m2-th3-1",
    "text": "วิเคราะห์ข้อเท็จจริง ข้อคิดเห็นและความ น่าเชื่อถือของข่าวสารจากสื่อต่าง ๆ",
    "sourcePage": 23,
    "sourcePdfPage": 23
  },
  {
    "id": "TH2551-31-M2-5",
    "code": "ท 3.1 ม.2/5",
    "standard": "TH3.1",
    "grade": "M2",
    "unitId": "m2-th3-1",
    "text": "พูดรายงานเรื่องหรือประเด็นที่ศึกษาค้นคว้า",
    "sourcePage": 23,
    "sourcePdfPage": 23
  },
  {
    "id": "TH2551-31-M2-4",
    "code": "ท 3.1 ม.2/4",
    "standard": "TH3.1",
    "grade": "M2",
    "unitId": "m2-th3-1",
    "text": "พูดในโอกาสต่าง ๆ",
    "sourcePage": 23,
    "sourcePdfPage": 23
  },
  {
    "id": "TH2551-31-M2-6",
    "code": "ท 3.1 ม.2/6",
    "standard": "TH3.1",
    "grade": "M2",
    "unitId": "m2-th3-1",
    "text": "มีมารยาทในการฟัง การดู และการพูด ได้ตรงตามวัตถุประสงค์",
    "sourcePage": 23,
    "sourcePdfPage": 23
  },
  {
    "id": "TH2551-41-M2-1",
    "code": "ท 4.1 ม.2/1",
    "standard": "TH4.1",
    "grade": "M2",
    "unitId": "m2-th4-1",
    "text": "สร้างคำในภาษาไทย 7",
    "sourcePage": 24,
    "sourcePdfPage": 24
  },
  {
    "id": "TH2551-41-M2-2",
    "code": "ท 4.1 ม.2/2",
    "standard": "TH4.1",
    "grade": "M2",
    "unitId": "m2-th4-1",
    "text": "วิเคราะห์โครงสร้าง ประโยคสามัญ ประโยครวมและ ประโยคซ้อน 8",
    "sourcePage": 24,
    "sourcePdfPage": 24
  },
  {
    "id": "TH2551-41-M2-4",
    "code": "ท 4.1 ม.2/4",
    "standard": "TH4.1",
    "grade": "M2",
    "unitId": "m2-th4-1",
    "text": "ใช้คำราชาศัพท์",
    "sourcePage": 24,
    "sourcePdfPage": 24
  },
  {
    "id": "TH2551-51-M2-5",
    "code": "ท 5.1 ม.2/5",
    "standard": "TH5.1",
    "grade": "M2",
    "unitId": "m2-th5-1",
    "text": "ท่องจำบทอาขยาน ตามที่กำหนดและบทร้อยกรองที่มี คุณค่าตามความสนใจ",
    "sourcePage": 24,
    "sourcePdfPage": 24
  },
  {
    "id": "TH2551-41-M3-5",
    "code": "ท 4.1 ม.3/5",
    "standard": "TH4.1",
    "grade": "M3",
    "unitId": "m3-th4-1",
    "text": "อธิบายความหมายคำศัพท์ทางวิชาการและ วิชาชีพ",
    "sourcePage": 25,
    "sourcePdfPage": 25
  },
  {
    "id": "TH2551-11-M3-2",
    "code": "ท 1.1 ม.3/2",
    "standard": "TH1.1",
    "grade": "M3",
    "unitId": "m3-th1-1",
    "text": "ระบุความแตกต่าง ของคำที่มีความหมายโดยตรง และ ความหมายโดยนัย",
    "sourcePage": 25,
    "sourcePdfPage": 25
  },
  {
    "id": "TH2551-11-M3-1",
    "code": "ท 1.1 ม.3/1",
    "standard": "TH1.1",
    "grade": "M3",
    "unitId": "m3-th1-1",
    "text": "อ่านออกเสียงบทร้อยแก้วและบทร้อยกรองได้ ถูกต้องเหมาะสมกับเรื่องที่อ่าน",
    "sourcePage": 25,
    "sourcePdfPage": 25
  },
  {
    "id": "TH2551-11-M3-3",
    "code": "ท 1.1 ม.3/3",
    "standard": "TH1.1",
    "grade": "M3",
    "unitId": "m3-th1-1",
    "text": "ระบุใจความสำคัญ และรายละเอียดของข้อมูลที่",
    "sourcePage": 25,
    "sourcePdfPage": 25
  },
  {
    "id": "TH2551-11-M3-4",
    "code": "ท 1.1 ม.3/4",
    "standard": "TH1.1",
    "grade": "M3",
    "unitId": "m3-th1-1",
    "text": "อ่านเรื่องต่าง ๆ แล้วเขียนกรอบแนวคิด ผังความคิด สนับสนุนจากเรื่องที่อ่าน บันทึก ย่อความและรายงานแก้ปัญหาในชีวิต",
    "sourcePage": 25,
    "sourcePdfPage": 25
  },
  {
    "id": "TH2551-51-M3-1",
    "code": "ท 5.1 ม.3/1",
    "standard": "TH5.1",
    "grade": "M3",
    "unitId": "m3-th5-1",
    "text": "สรุปเนื้อหาวรรณคดีและวรรณกรรมที่อ่าน ในระดับที่ยากขึ้น ในชีวิตจริง",
    "sourcePage": 25,
    "sourcePdfPage": 25
  },
  {
    "id": "TH2551-51-M3-3",
    "code": "ท 5.1 ม.3/3",
    "standard": "TH5.1",
    "grade": "M3",
    "unitId": "m3-th5-1",
    "text": "สรุปความรู้และข้อคิดจากการอ่านเพื่อนำไป ประยุกต์ใช้",
    "sourcePage": 25,
    "sourcePdfPage": 25
  },
  {
    "id": "TH2551-11-M3-6",
    "code": "ท 1.1 ม.3/6",
    "standard": "TH1.1",
    "grade": "M3",
    "unitId": "m3-th1-1",
    "text": "ประเมินความถูกต้องของข้อมูลที่ใช้สนับสนุน ในเรื่องที่อ่าน",
    "sourcePage": 25,
    "sourcePdfPage": 25
  },
  {
    "id": "TH2551-11-M3-5",
    "code": "ท 1.1 ม.3/5",
    "standard": "TH1.1",
    "grade": "M3",
    "unitId": "m3-th1-1",
    "text": "วิเคราะห์ วิจารณ์ และประเมินเรื่อง ที่อ่านโดยใช้ กลวิธีการเปรียบเทียบเพื่อให้ผู้อ่าน เข้าใจได้ดีขึ้น",
    "sourcePage": 25,
    "sourcePdfPage": 25
  },
  {
    "id": "TH2551-11-M3-7",
    "code": "ท 1.1 ม.3/7",
    "standard": "TH1.1",
    "grade": "M3",
    "unitId": "m3-th1-1",
    "text": "วิจารณ์ความสมเหตุสมผลการลำดับความและ ความเป็นไปได้ของเรื่อง",
    "sourcePage": 25,
    "sourcePdfPage": 25
  },
  {
    "id": "TH2551-11-M3-8",
    "code": "ท 1.1 ม.3/8",
    "standard": "TH1.1",
    "grade": "M3",
    "unitId": "m3-th1-1",
    "text": "วิเคราะห์เพื่อแสดงความคิดเห็นโต้แย้งเกี่ยวกับ เรื่องที่อ่าน",
    "sourcePage": 25,
    "sourcePdfPage": 25
  },
  {
    "id": "TH2551-11-M3-9",
    "code": "ท 1.1 ม.3/9",
    "standard": "TH1.1",
    "grade": "M3",
    "unitId": "m3-th1-1",
    "text": "ตีความและประเมินคุณค่าและแนวคิดที่ได้จาก งานเขียนอย่างหลากหลายเพื่อนำไปใช้",
    "sourcePage": 25,
    "sourcePdfPage": 25
  },
  {
    "id": "TH2551-11-M3-10",
    "code": "ท 1.1 ม.3/10",
    "standard": "TH1.1",
    "grade": "M3",
    "unitId": "m3-th1-1",
    "text": "มีมารยาทในการอ่าน",
    "sourcePage": 25,
    "sourcePdfPage": 25
  },
  {
    "id": "TH2551-51-M3-2",
    "code": "ท 5.1 ม.3/2",
    "standard": "TH5.1",
    "grade": "M3",
    "unitId": "m3-th5-1",
    "text": "วิเคราะห์วิถีไทย และคุณค่าจากวรรณคดี และ วรรณกรรมที่อ่าน",
    "sourcePage": 25,
    "sourcePdfPage": 25
  },
  {
    "id": "TH2551-21-M3-1",
    "code": "ท 2.1 ม.3/1",
    "standard": "TH2.1",
    "grade": "M3",
    "unitId": "m3-th2-1",
    "text": "คัดลายมือตัวบรรจงครึ่งบรรทัด",
    "sourcePage": 26,
    "sourcePdfPage": 26
  },
  {
    "id": "TH2551-21-M3-2",
    "code": "ท 2.1 ม.3/2",
    "standard": "TH2.1",
    "grade": "M3",
    "unitId": "m3-th2-1",
    "text": "เขียนข้อความโดย",
    "sourcePage": 26,
    "sourcePdfPage": 26
  },
  {
    "id": "TH2551-21-M3-3",
    "code": "ท 2.1 ม.3/3",
    "standard": "TH2.1",
    "grade": "M3",
    "unitId": "m3-th2-1",
    "text": "เขียนชีวประวัติหรืออัตชีวประวัติโดยเล่า ใช้ถ้อยคำได้ถูกต้องตามระดับภาษา เหตุการณ์ ข้อคิดเห็น และทัศนคติในเรื่องต่าง ๆ",
    "sourcePage": 26,
    "sourcePdfPage": 26
  },
  {
    "id": "TH2551-21-M3-4",
    "code": "ท 2.1 ม.3/4",
    "standard": "TH2.1",
    "grade": "M3",
    "unitId": "m3-th2-1",
    "text": "เขียนย่อความ",
    "sourcePage": 26,
    "sourcePdfPage": 26
  },
  {
    "id": "TH2551-21-M3-5",
    "code": "ท 2.1 ม.3/5",
    "standard": "TH2.1",
    "grade": "M3",
    "unitId": "m3-th2-1",
    "text": "เขียนจดหมายกิจธุระ",
    "sourcePage": 26,
    "sourcePdfPage": 26
  },
  {
    "id": "TH2551-21-M3-6",
    "code": "ท 2.1 ม.3/6",
    "standard": "TH2.1",
    "grade": "M3",
    "unitId": "m3-th2-1",
    "text": "เขียนอธิบาย ชี้แจง แสดงความคิดเห็นและ โต้แย้งอย่างมีเหตุผล",
    "sourcePage": 26,
    "sourcePdfPage": 26
  },
  {
    "id": "TH2551-21-M3-7",
    "code": "ท 2.1 ม.3/7",
    "standard": "TH2.1",
    "grade": "M3",
    "unitId": "m3-th2-1",
    "text": "เขียนวิเคราะห์ วิจารณ์ และแสดงความรู้ ความ คิดเห็น หรือโต้แย้งในเรื่องต่างๆ",
    "sourcePage": 26,
    "sourcePdfPage": 26
  },
  {
    "id": "TH2551-21-M3-8",
    "code": "ท 2.1 ม.3/8",
    "standard": "TH2.1",
    "grade": "M3",
    "unitId": "m3-th2-1",
    "text": "กรอกแบบสมัครงานพร้อมเขียนบรรยายเกี่ยวกับ ความรู้และทักษะของตนเองที่เหมาะสมกับงาน",
    "sourcePage": 26,
    "sourcePdfPage": 26
  },
  {
    "id": "TH2551-21-M3-9",
    "code": "ท 2.1 ม.3/9",
    "standard": "TH2.1",
    "grade": "M3",
    "unitId": "m3-th2-1",
    "text": "เขียนรายงานการศึกษาค้นคว้า และโครงงาน",
    "sourcePage": 26,
    "sourcePdfPage": 26
  },
  {
    "id": "TH2551-21-M3-10",
    "code": "ท 2.1 ม.3/10",
    "standard": "TH2.1",
    "grade": "M3",
    "unitId": "m3-th2-1",
    "text": "มีมารยาทในการเขียน",
    "sourcePage": 26,
    "sourcePdfPage": 26
  },
  {
    "id": "TH2551-31-M3-1",
    "code": "ท 3.1 ม.3/1",
    "standard": "TH3.1",
    "grade": "M3",
    "unitId": "m3-th3-1",
    "text": "แสดงความคิดเห็นและประเมินเรื่องจากการฟัง และการดู",
    "sourcePage": 26,
    "sourcePdfPage": 26
  },
  {
    "id": "TH2551-31-M3-2",
    "code": "ท 3.1 ม.3/2",
    "standard": "TH3.1",
    "grade": "M3",
    "unitId": "m3-th3-1",
    "text": "วิเคราะห์และวิจารณ์ เรื่องที่ฟังและดู เพื่อนำข้อคิดมา ประยุกต์ใช้ในการดำเนินชีวิต",
    "sourcePage": 26,
    "sourcePdfPage": 26
  },
  {
    "id": "TH2551-31-M3-3",
    "code": "ท 3.1 ม.3/3",
    "standard": "TH3.1",
    "grade": "M3",
    "unitId": "m3-th3-1",
    "text": "พูดรายงานเรื่องหรือประเด็นที่ศึกษาค้นคว้า จากการฟัง การดู และการสนทนา",
    "sourcePage": 26,
    "sourcePdfPage": 26
  },
  {
    "id": "TH2551-31-M3-4",
    "code": "ท 3.1 ม.3/4",
    "standard": "TH3.1",
    "grade": "M3",
    "unitId": "m3-th3-1",
    "text": "พูดในโอกาสต่าง ๆ ได้ตรงตามวัตถุประสงค์",
    "sourcePage": 26,
    "sourcePdfPage": 26
  },
  {
    "id": "TH2551-31-M3-5",
    "code": "ท 3.1 ม.3/5",
    "standard": "TH3.1",
    "grade": "M3",
    "unitId": "m3-th3-1",
    "text": "พูดโน้มน้าวโดยนำเสนอหลักฐานตาม ลำดับ เนื้อหาอย่างมีเหตุผล และน่าเชื่อถือ",
    "sourcePage": 26,
    "sourcePdfPage": 26
  },
  {
    "id": "TH2551-31-M3-6",
    "code": "ท 3.1 ม.3/6",
    "standard": "TH3.1",
    "grade": "M3",
    "unitId": "m3-th3-1",
    "text": "มีมารยาท ในการฟัง การดู และการพูด",
    "sourcePage": 26,
    "sourcePdfPage": 26
  },
  {
    "id": "TH2551-41-M3-4",
    "code": "ท 4.1 ม.3/4",
    "standard": "TH4.1",
    "grade": "M3",
    "unitId": "m3-th4-1",
    "text": "ใช้คำทับศัพท์และศัพท์บัญญัติ",
    "sourcePage": 27,
    "sourcePdfPage": 27
  },
  {
    "id": "TH2551-41-M3-1",
    "code": "ท 4.1 ม.3/1",
    "standard": "TH4.1",
    "grade": "M3",
    "unitId": "m3-th4-1",
    "text": "จำแนกและใช้คำ ภาษาต่างประเทศที่ใช้ในภาษาไทย",
    "sourcePage": 27,
    "sourcePdfPage": 27
  },
  {
    "id": "TH2551-41-M3-2",
    "code": "ท 4.1 ม.3/2",
    "standard": "TH4.1",
    "grade": "M3",
    "unitId": "m3-th4-1",
    "text": "วิเคราะห์โครงสร้างประโยคซับซ้อน",
    "sourcePage": 27,
    "sourcePdfPage": 27
  },
  {
    "id": "TH2551-41-M3-3",
    "code": "ท 4.1 ม.3/3",
    "standard": "TH4.1",
    "grade": "M3",
    "unitId": "m3-th4-1",
    "text": "วิเคราะห์ระดับภาษา 9",
    "sourcePage": 27,
    "sourcePdfPage": 27
  },
  {
    "id": "TH2551-41-M3-6",
    "code": "ท 4.1 ม.3/6",
    "standard": "TH4.1",
    "grade": "M3",
    "unitId": "m3-th4-1",
    "text": "แต่งบทร้อยกรอง",
    "sourcePage": 27,
    "sourcePdfPage": 27
  },
  {
    "id": "TH2551-51-M3-4",
    "code": "ท 5.1 ม.3/4",
    "standard": "TH5.1",
    "grade": "M3",
    "unitId": "m3-th5-1",
    "text": "ท่องจำและบอก คุณค่าบทอาขยานตามที่กำหนด และบทร้อยกรองที่มีคุณค่าตาม ความสนใจและนำไปใช้อ้างอิง",
    "sourcePage": 27,
    "sourcePdfPage": 27
  }
];

  window.CK_CURRICULUM_THAI_2551 = { source, standards, units, indicators };
})();
