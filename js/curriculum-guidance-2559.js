/**
 * Guidance activity outcomes and lesson-plan references.
 * Source data is versioned separately because guidance is a learner-development
 * activity, not one of the eight core subject groups.
 */
(function () {
  'use strict';

  const source = {
    id: 'TH-BEC-GUIDANCE-2559',
    title: 'มาตรฐานการแนะแนว',
    framework: 'แนวทางกิจกรรมแนะแนวระดับการศึกษาขั้นพื้นฐาน',
    revisionYear: 2559,
    publisher: 'สำนักงานคณะกรรมการการศึกษาขั้นพื้นฐาน และสมาคมแนะแนวแห่งประเทศไทย',
    fileName: '07 มาตรฐานการแนะแนว.pdf',
    status: 'reference',
    notice: 'กรอบเป้าหมายผู้เรียนจากเอกสารพิมพ์ พ.ศ. 2559 ใช้เป็นข้อมูลอ้างอิงและตรวจเทียบกับหลักสูตรสถานศึกษาก่อนใช้',
    relatedSources: [
      {
        title: 'แนวทางการจัดกิจกรรมพัฒนาผู้เรียน ตามหลักสูตรแกนกลางการศึกษาขั้นพื้นฐาน พ.ศ. 2551',
        publisher: 'สำนักวิชาการและมาตรฐานการศึกษา สพฐ.',
        url: 'https://academic.obec.go.th/web/images/document/1760458207_d_1.pdf'
      },
      {
        title: 'คู่มือการบริหารจัดการหลักสูตรประถมศึกษาตอนต้น พ.ศ. 2568',
        publisher: 'สำนักวิชาการและมาตรฐานการศึกษา สพฐ.',
        url: 'https://www.academic.obec.go.th/web/images/mission/1744086544_d_2.pdf'
      }
    ]
  };

  const standards = [
    {
      id: 'GD1',
      code: 'มาตรฐานที่ 1',
      title: 'ผู้เรียนรู้จัก เข้าใจ รักและเห็นคุณค่าในตนเองและผู้อื่น',
      strand: 'คุณภาพผู้เรียน'
    },
    {
      id: 'GD2',
      code: 'มาตรฐานที่ 2',
      title: 'ผู้เรียนสามารถวางแผนชีวิตด้านการศึกษา ด้านอาชีพ และด้านส่วนตัวและสังคม',
      strand: 'คุณภาพผู้เรียน'
    }
  ];

  const units = [
    {
      id: 'guidance-education',
      grade: 'ALL',
      title: 'ด้านการศึกษา',
      description: 'เป้าหมายและการวางแผนชีวิตด้านการศึกษา'
    },
    {
      id: 'guidance-career',
      grade: 'ALL',
      title: 'ด้านอาชีพ',
      description: 'การรู้จัก วิเคราะห์ และวางแผนเส้นทางอาชีพ'
    },
    {
      id: 'guidance-personal-social',
      grade: 'ALL',
      title: 'ด้านส่วนตัวและสังคม',
      description: 'การรู้จักและพัฒนาตนเอง เห็นคุณค่าผู้อื่น และวางแผนชีวิตส่วนตัวและสังคม'
    }
  ];

  const indicators = [
    {
      id: 'GUIDANCE-2559-1.1',
      code: 'แนะแนว 1.1',
      standard: 'GD1',
      grade: 'ALL',
      unitId: 'guidance-personal-social',
      text: 'ผู้เรียนรู้จัก เข้าใจ รักและเห็นคุณค่าในตนเอง และพัฒนาตนเองอย่างต่อเนื่อง',
      sourcePage: 3,
      sourcePdfPage: 15
    },
    {
      id: 'GUIDANCE-2559-1.2',
      code: 'แนะแนว 1.2',
      standard: 'GD1',
      grade: 'ALL',
      unitId: 'guidance-personal-social',
      text: 'ผู้เรียนรู้จัก เข้าใจ รักและเห็นคุณค่าผู้อื่น และปฏิบัติตนต่อผู้อื่นอย่างเหมาะสม',
      sourcePage: 4,
      sourcePdfPage: 16
    },
    {
      id: 'GUIDANCE-2559-2.1',
      code: 'แนะแนว 2.1',
      standard: 'GD2',
      grade: 'ALL',
      unitId: 'guidance-education',
      text: 'ผู้เรียนสามารถศึกษา วิเคราะห์ ตัดสินใจ แก้ปัญหาและวางแผนด้านการศึกษา',
      sourcePage: 6,
      sourcePdfPage: 18
    },
    {
      id: 'GUIDANCE-2559-2.2',
      code: 'แนะแนว 2.2',
      standard: 'GD2',
      grade: 'ALL',
      unitId: 'guidance-career',
      text: 'ผู้เรียนสามารถคิดวิเคราะห์ ตัดสินใจ แก้ปัญหาและวางแผนด้านอาชีพ',
      sourcePage: 8,
      sourcePdfPage: 20
    },
    {
      id: 'GUIDANCE-2559-2.3',
      code: 'แนะแนว 2.3',
      standard: 'GD2',
      grade: 'ALL',
      unitId: 'guidance-personal-social',
      text: 'ผู้เรียนสามารถคิดวิเคราะห์ ตัดสินใจ แก้ปัญหาและวางแผนด้านส่วนตัวและสังคม',
      sourcePage: 9,
      sourcePdfPage: 21
    }
  ];

  const reference = {
    lessonPlanType: 'แผนการจัดการเรียนรู้กิจกรรมแนะแนวรายคาบ',
    publicationYear: 2559,
    sourceFileName: '01 การจัดการเรียนรู้กิจกรรมแนะแนว.pdf',
    sourcePdfPages: [40, 41],
    fields: [
      'สาระสำคัญ',
      'จุดประสงค์การเรียนรู้',
      'สาระการเรียนรู้',
      'สมรรถนะสำคัญ',
      'คุณลักษณะอันพึงประสงค์',
      'ความสามารถและทักษะในศตวรรษที่ 21',
      'วิธีดำเนินกิจกรรม',
      'สื่อ/อุปกรณ์/แหล่งเรียนรู้',
      'การวัดและประเมินผล',
      'กิจกรรมเสนอแนะ',
      'บันทึกหลังการจัดกิจกรรม'
    ],
    examples: [
      {
        id: 'GUIDANCE-P1-HONESTY-2559',
        grade: 'P1',
        title: 'ใจซื่อ...ซื้อไม่ได้',
        sourcePdfPages: [45, 46, 47],
        keyConcept: 'ความซื่อสัตย์แสดงผ่านความคิด คำพูด และการกระทำที่ตรงกับความจริง',
        objectives: [
          'ให้นักเรียนแสดงความคิดเห็นเกี่ยวกับปัจจัยที่มีผลต่อความซื่อสัตย์สุจริต',
          'ให้นักเรียนบอกวิธีแก้ไขหรือพัฒนาตนเองให้เป็นผู้มีความซื่อสัตย์สุจริต'
        ],
        activityOutline: [
          'ชวนสนทนาจากปัญหาในชีวิตประจำวันที่เกี่ยวกับความซื่อสัตย์',
          'ให้นักเรียนพิจารณาสถานการณ์และตอบคำถามในใบงาน',
          'อภิปรายแนวทางแก้ปัญหาและสรุปการนำไปใช้ในชีวิตประจำวัน'
        ],
        resources: ['ใบงานเรื่องความซื่อสัตย์'],
        assessment: ['พิจารณาคำตอบต่อสถานการณ์', 'สังเกตการมีส่วนร่วมในกิจกรรม'],
        note: 'จัดหมวดเป็นตัวอย่างด้านส่วนตัวและสังคมเพื่อช่วยค้นหา; ครูควรตรวจความสอดคล้องกับบริบทชั้นเรียนก่อนนำไปใช้'
      }
    ]
  };

  window.CK_CURRICULUM_GUIDANCE_2559 = {
    id: 'guidance',
    title: 'กิจกรรมแนะแนว',
    scoreCompatible: false,
    source,
    grades: ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M4_6'],
    standards,
    units,
    indicators,
    reference
  };
})();
