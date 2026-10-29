-- Read-only normalized curriculum catalog. Run through the project's reviewed
-- Supabase migration workflow; this file intentionally does not apply itself.
begin;

create table if not exists public.curriculum_sources (
  source_id text primary key,
  title text not null,
  framework text not null default '',
  revision_year integer,
  publisher text not null default '',
  file_name text not null default '',
  status text not null default 'reference',
  notice text not null default '',
  related_sources jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.curriculum_standards (
  source_id text not null references public.curriculum_sources(source_id) on delete cascade,
  subject_id text not null,
  standard_id text not null,
  code text not null,
  title text not null,
  strand text not null default '',
  primary key (source_id, subject_id, standard_id)
);

create table if not exists public.curriculum_units (
  source_id text not null references public.curriculum_sources(source_id) on delete cascade,
  subject_id text not null,
  unit_id text not null,
  grade text not null default 'ALL',
  title text not null,
  description text not null default '',
  primary key (source_id, subject_id, unit_id)
);

create table if not exists public.curriculum_outcomes (
  outcome_id text primary key,
  source_id text not null references public.curriculum_sources(source_id) on delete cascade,
  subject_id text not null,
  standard_id text not null,
  grade text not null default 'ALL',
  unit_id text not null,
  code text not null,
  outcome_text text not null,
  source_page integer,
  source_pdf_page integer
);

create table if not exists public.curriculum_references (
  source_id text not null references public.curriculum_sources(source_id) on delete cascade,
  subject_id text not null,
  reference_id text not null,
  reference_payload jsonb not null,
  primary key (source_id, subject_id, reference_id)
);

create index if not exists curriculum_outcomes_lookup_idx
  on public.curriculum_outcomes (subject_id, grade, unit_id, standard_id);

alter table public.curriculum_sources enable row level security;
alter table public.curriculum_standards enable row level security;
alter table public.curriculum_units enable row level security;
alter table public.curriculum_outcomes enable row level security;
alter table public.curriculum_references enable row level security;

drop policy if exists curriculum_sources_read on public.curriculum_sources;
create policy curriculum_sources_read on public.curriculum_sources for select to anon, authenticated using (true);
drop policy if exists curriculum_standards_read on public.curriculum_standards;
create policy curriculum_standards_read on public.curriculum_standards for select to anon, authenticated using (true);
drop policy if exists curriculum_units_read on public.curriculum_units;
create policy curriculum_units_read on public.curriculum_units for select to anon, authenticated using (true);
drop policy if exists curriculum_outcomes_read on public.curriculum_outcomes;
create policy curriculum_outcomes_read on public.curriculum_outcomes for select to anon, authenticated using (true);
drop policy if exists curriculum_references_read on public.curriculum_references;
create policy curriculum_references_read on public.curriculum_references for select to anon, authenticated using (true);

grant select on public.curriculum_sources, public.curriculum_standards, public.curriculum_units, public.curriculum_outcomes, public.curriculum_references to anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on public.curriculum_sources, public.curriculum_standards, public.curriculum_units, public.curriculum_outcomes, public.curriculum_references from anon, authenticated;

insert into public.curriculum_sources (source_id, title, framework, revision_year, publisher, file_name, status, notice, related_sources)
values (
  'TH-BEC-GUIDANCE-2559',
  'มาตรฐานการแนะแนว',
  'แนวทางกิจกรรมแนะแนวระดับการศึกษาขั้นพื้นฐาน',
  2559,
  'สำนักงานคณะกรรมการการศึกษาขั้นพื้นฐาน และสมาคมแนะแนวแห่งประเทศไทย',
  '07 มาตรฐานการแนะแนว.pdf',
  'reference',
  'กรอบเป้าหมายผู้เรียนจากเอกสารพิมพ์ พ.ศ. 2559 ใช้เป็นข้อมูลอ้างอิงและตรวจเทียบกับหลักสูตรสถานศึกษาก่อนใช้',
  '[{"title":"แนวทางการจัดกิจกรรมพัฒนาผู้เรียน ตามหลักสูตรแกนกลางการศึกษาขั้นพื้นฐาน พ.ศ. 2551","publisher":"สำนักวิชาการและมาตรฐานการศึกษา สพฐ.","url":"https://academic.obec.go.th/web/images/document/1760458207_d_1.pdf"},{"title":"คู่มือการบริหารจัดการหลักสูตรประถมศึกษาตอนต้น พ.ศ. 2568","publisher":"สำนักวิชาการและมาตรฐานการศึกษา สพฐ.","url":"https://www.academic.obec.go.th/web/images/mission/1744086544_d_2.pdf"}]'::jsonb
)
on conflict (source_id) do update set title=excluded.title, framework=excluded.framework, revision_year=excluded.revision_year, publisher=excluded.publisher, file_name=excluded.file_name, status=excluded.status, notice=excluded.notice, related_sources=excluded.related_sources, updated_at=now();

insert into public.curriculum_standards (source_id, subject_id, standard_id, code, title, strand) values
('TH-BEC-GUIDANCE-2559','guidance','GD1','มาตรฐานที่ 1','ผู้เรียนรู้จัก เข้าใจ รักและเห็นคุณค่าในตนเองและผู้อื่น','คุณภาพผู้เรียน'),
('TH-BEC-GUIDANCE-2559','guidance','GD2','มาตรฐานที่ 2','ผู้เรียนสามารถวางแผนชีวิตด้านการศึกษา ด้านอาชีพ และด้านส่วนตัวและสังคม','คุณภาพผู้เรียน')
on conflict (source_id, subject_id, standard_id) do update set code=excluded.code, title=excluded.title, strand=excluded.strand;

insert into public.curriculum_units (source_id, subject_id, unit_id, grade, title, description) values
('TH-BEC-GUIDANCE-2559','guidance','guidance-education','ALL','ด้านการศึกษา','เป้าหมายและการวางแผนชีวิตด้านการศึกษา'),
('TH-BEC-GUIDANCE-2559','guidance','guidance-career','ALL','ด้านอาชีพ','การรู้จัก วิเคราะห์ และวางแผนเส้นทางอาชีพ'),
('TH-BEC-GUIDANCE-2559','guidance','guidance-personal-social','ALL','ด้านส่วนตัวและสังคม','การรู้จักและพัฒนาตนเอง เห็นคุณค่าผู้อื่น และวางแผนชีวิตส่วนตัวและสังคม')
on conflict (source_id, subject_id, unit_id) do update set grade=excluded.grade, title=excluded.title, description=excluded.description;

insert into public.curriculum_outcomes (outcome_id, source_id, subject_id, standard_id, grade, unit_id, code, outcome_text, source_page, source_pdf_page) values
('GUIDANCE-2559-1.1','TH-BEC-GUIDANCE-2559','guidance','GD1','ALL','guidance-personal-social','แนะแนว 1.1','ผู้เรียนรู้จัก เข้าใจ รักและเห็นคุณค่าในตนเอง และพัฒนาตนเองอย่างต่อเนื่อง',3,15),
('GUIDANCE-2559-1.2','TH-BEC-GUIDANCE-2559','guidance','GD1','ALL','guidance-personal-social','แนะแนว 1.2','ผู้เรียนรู้จัก เข้าใจ รักและเห็นคุณค่าผู้อื่น และปฏิบัติตนต่อผู้อื่นอย่างเหมาะสม',4,16),
('GUIDANCE-2559-2.1','TH-BEC-GUIDANCE-2559','guidance','GD2','ALL','guidance-education','แนะแนว 2.1','ผู้เรียนสามารถศึกษา วิเคราะห์ ตัดสินใจ แก้ปัญหาและวางแผนด้านการศึกษา',6,18),
('GUIDANCE-2559-2.2','TH-BEC-GUIDANCE-2559','guidance','GD2','ALL','guidance-career','แนะแนว 2.2','ผู้เรียนสามารถคิดวิเคราะห์ ตัดสินใจ แก้ปัญหาและวางแผนด้านอาชีพ',8,20),
('GUIDANCE-2559-2.3','TH-BEC-GUIDANCE-2559','guidance','GD2','ALL','guidance-personal-social','แนะแนว 2.3','ผู้เรียนสามารถคิดวิเคราะห์ ตัดสินใจ แก้ปัญหาและวางแผนด้านส่วนตัวและสังคม',9,21)
on conflict (outcome_id) do update set standard_id=excluded.standard_id, grade=excluded.grade, unit_id=excluded.unit_id, code=excluded.code, outcome_text=excluded.outcome_text, source_page=excluded.source_page, source_pdf_page=excluded.source_pdf_page;

insert into public.curriculum_references (source_id, subject_id, reference_id, reference_payload)
values ('TH-BEC-GUIDANCE-2559','guidance','lesson-plan-template-2559', '{"lessonPlanType":"แผนการจัดการเรียนรู้กิจกรรมแนะแนวรายคาบ","publicationYear":2559,"sourceFileName":"01 การจัดการเรียนรู้กิจกรรมแนะแนว.pdf","sourcePdfPages":[40,41],"fields":["สาระสำคัญ","จุดประสงค์การเรียนรู้","สาระการเรียนรู้","สมรรถนะสำคัญ","คุณลักษณะอันพึงประสงค์","ความสามารถและทักษะในศตวรรษที่ 21","วิธีดำเนินกิจกรรม","สื่อ/อุปกรณ์/แหล่งเรียนรู้","การวัดและประเมินผล","กิจกรรมเสนอแนะ","บันทึกหลังการจัดกิจกรรม"],"examples":[{"id":"GUIDANCE-P1-HONESTY-2559","grade":"P1","title":"ใจซื่อ...ซื้อไม่ได้","sourcePdfPages":[45,46,47],"keyConcept":"ความซื่อสัตย์แสดงผ่านความคิด คำพูด และการกระทำที่ตรงกับความจริง","objectives":["ให้นักเรียนแสดงความคิดเห็นเกี่ยวกับปัจจัยที่มีผลต่อความซื่อสัตย์สุจริต","ให้นักเรียนบอกวิธีแก้ไขหรือพัฒนาตนเองให้เป็นผู้มีความซื่อสัตย์สุจริต"],"activityOutline":["ชวนสนทนาจากปัญหาในชีวิตประจำวันที่เกี่ยวกับความซื่อสัตย์","ให้นักเรียนพิจารณาสถานการณ์และตอบคำถามในใบงาน","อภิปรายแนวทางแก้ปัญหาและสรุปการนำไปใช้ในชีวิตประจำวัน"],"resources":["ใบงานเรื่องความซื่อสัตย์"],"assessment":["พิจารณาคำตอบต่อสถานการณ์","สังเกตการมีส่วนร่วมในกิจกรรม"],"note":"จัดหมวดเป็นตัวอย่างด้านส่วนตัวและสังคมเพื่อช่วยค้นหา; ครูควรตรวจความสอดคล้องกับบริบทชั้นเรียนก่อนนำไปใช้"}]}')
on conflict (source_id, subject_id, reference_id) do update set reference_payload=excluded.reference_payload;

commit;
