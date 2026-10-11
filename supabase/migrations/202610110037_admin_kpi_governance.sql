-- Admin KPI scorecards, evaluator chain and evidence-first monthly evaluation.
-- Effective 2026-10-11 per KPI Team notice. Existing department KPI history is untouched.
begin;

create table if not exists public.kpi_scorecards (
  code text primary key,
  department_code text not null references public.departments(code),
  name text not null,
  position_group text not null check(position_group in ('staff','lead','management')),
  cadence text not null default 'monthly' check(cadence='monthly'),
  total_score numeric not null default 100 check(total_score=100),
  effective_from date not null,
  active boolean not null default true,
  evaluator_policy jsonb not null default '{}'::jsonb,
  grade_policy jsonb not null default '{}'::jsonb,
  integrity_policy jsonb not null default '{}'::jsonb,
  source_documents text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.kpi_scorecard_items (
  id uuid primary key default gen_random_uuid(),
  scorecard_code text not null references public.kpi_scorecards(code) on delete cascade,
  item_code text not null,
  category_code text not null,
  category_name text not null,
  name text not null,
  criteria text not null,
  max_score numeric not null check(max_score>0 and max_score<=100),
  rubric jsonb not null default '{}'::jsonb,
  evidence_requirements text not null,
  sort_order integer not null,
  unique(scorecard_code,item_code)
);

create table if not exists public.kpi_evaluator_assignments (
  id uuid primary key default gen_random_uuid(),
  evaluatee_id uuid not null references public.profiles(id),
  scorecard_code text references public.kpi_scorecards(code),
  evaluator_id uuid not null references public.profiles(id),
  reviewer_id uuid references public.profiles(id),
  effective_from date not null default current_date,
  effective_to date,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  check(evaluatee_id<>evaluator_id),
  check(reviewer_id is null or reviewer_id<>evaluator_id),
  check(effective_to is null or effective_to>=effective_from)
);
create unique index if not exists kpi_evaluator_assignment_active_idx
  on public.kpi_evaluator_assignments(evaluatee_id,effective_from);

create table if not exists public.kpi_evaluations (
  id uuid primary key default gen_random_uuid(),
  evaluatee_id uuid not null references public.profiles(id),
  scorecard_code text not null references public.kpi_scorecards(code),
  period_start date not null,
  period_end date not null,
  evaluator_id uuid not null references public.profiles(id),
  reviewer_id uuid references public.profiles(id),
  status text not null default 'draft' check(status in ('draft','returned','submitted','approved','locked','voided')),
  total_score numeric,
  grade text check(grade is null or grade in ('A','B','C','D')),
  evaluator_note text not null default '',
  employee_comment text not null default '',
  return_reason text not null default '',
  void_reason text not null default '',
  submitted_at timestamptz,
  approved_at timestamptz,
  voided_at timestamptz,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(period_start=date_trunc('month',period_start)::date),
  check(period_end=(period_start+interval '1 month - 1 day')::date),
  check(evaluatee_id<>evaluator_id),
  check(total_score is null or total_score between 0 and 100)
);
create unique index if not exists kpi_evaluation_one_live_round_idx
  on public.kpi_evaluations(evaluatee_id,scorecard_code,period_start)
  where status<>'voided';

create table if not exists public.kpi_evaluation_scores (
  evaluation_id uuid not null references public.kpi_evaluations(id) on delete cascade,
  item_id uuid not null references public.kpi_scorecard_items(id),
  score numeric not null check(score>=0),
  evidence_note text not null default '',
  evidence_urls jsonb not null default '[]'::jsonb check(jsonb_typeof(evidence_urls)='array'),
  updated_at timestamptz not null default now(),
  primary key(evaluation_id,item_id)
);

create table if not exists public.kpi_evaluation_comments (
  id bigint generated always as identity primary key,
  evaluation_id uuid not null references public.kpi_evaluations(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  body text not null check(char_length(trim(body)) between 1 and 3000),
  created_at timestamptz not null default now()
);

create table if not exists public.kpi_evaluation_audit (
  id bigint generated always as identity primary key,
  evaluation_id uuid not null references public.kpi_evaluations(id),
  actor_id uuid not null references public.profiles(id),
  event_type text not null,
  before_row jsonb,
  after_row jsonb,
  reason text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.kpi_policy_notices (
  code text primary key,
  source_team text not null,
  title text not null,
  body text not null,
  effective_from date not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.kpi_policy_acknowledgements (
  notice_code text not null references public.kpi_policy_notices(code) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  acknowledged_at timestamptz not null default now(),
  primary key(notice_code,profile_id)
);

insert into public.kpi_scorecards(code,department_code,name,position_group,effective_from,evaluator_policy,grade_policy,integrity_policy,source_documents)
values
('ADMIN-STAFF-2026','ADMIN','KPI พนักงาน Admin','staff','2026-10-11',
 '{"evaluated_by":["ผู้ช่วยหัวหน้า","หัวหน้า"]}',
 '{"A":"90-100","B":"80-89","C":"70-79","D":"ต่ำกว่า 70"}',
 '{"evidence_required":true,"self_evaluation":false,"void_and_reassess":true,"discipline_requires_fact_finding":true}',
 array['KPI ADMIN.pdf']),
('ADMIN-LEAD-2026','ADMIN','KPI รอง / ผู้ช่วยหัวหน้า / หัวหน้า Admin','lead','2026-10-11',
 '{"รอง":"ผู้ช่วยหัวหน้า","ผู้ช่วยหัวหน้า":"หัวหน้า","หัวหน้า":"ทีมบริหาร Admin"}',
 '{"A":"90-100","B":"80-89","C":"70-79","D":"ต่ำกว่า 70"}',
 '{"evidence_required":true,"self_evaluation":false,"void_and_reassess":true,"discipline_requires_fact_finding":true}',
 array['KPI HEAD ADMIN.pdf']),
('ADMIN-MGMT-2026','ADMIN','KPI บริหารแอดมิน','management','2026-10-11',
 '{"evaluated_by":["ทีมบริหาร","ทีม KPI"]}',
 '{"A":"90-100","B":"80-89","C":"70-79","D":"ต่ำกว่า 70"}',
 '{"evidence_required":true,"self_evaluation":false,"void_and_reassess":true,"discipline_requires_fact_finding":true}',
 array['KPI บริหารแอดมิน.pdf'])
on conflict(code) do update set name=excluded.name,effective_from=excluded.effective_from,evaluator_policy=excluded.evaluator_policy,grade_policy=excluded.grade_policy,integrity_policy=excluded.integrity_policy,source_documents=excluded.source_documents,active=true,updated_at=now();

-- Shared sections: organization goals 24, discipline 10, development 10 and special work 4.
with cards as (select code from public.kpi_scorecards where code in ('ADMIN-STAFF-2026','ADMIN-LEAD-2026','ADMIN-MGMT-2026'))
insert into public.kpi_scorecard_items(scorecard_code,item_code,category_code,category_name,name,criteria,max_score,rubric,evidence_requirements,sort_order)
select c.code,v.item_code,v.category_code,v.category_name,v.name,v.criteria,v.max_score,v.rubric::jsonb,v.evidence_requirements,v.sort_order from cards c cross join (values
 ('3.1','3','เป้าหมายรวมองค์กร / การเติบโตของธุรกิจ','ผลักดันเป้าหมาย Active','ลูกค้า Active ทุกบริษัทสูงกว่าเดือนก่อน 5% ได้ 8 คะแนน และสูงกว่า 3% ได้ 4 คะแนน',12,'{"tiers":[{"growth_gt":0.05,"score":8},{"growth_gt":0.03,"score":4}],"cumulative":true}','รายงาน Active เดือนปัจจุบันเทียบเดือนก่อน แยกทุกบริษัท พร้อมที่มาของยอด',301),
 ('3.2','3','เป้าหมายรวมองค์กร / การเติบโตของธุรกิจ','ขยายฐานสมาชิกใหม่','สมาชิกใหม่ที่สมัครและเติมจริงเกิน 50% ได้ 8 คะแนน และเกิน 40% ได้ 4 คะแนน',12,'{"tiers":[{"conversion_gt":0.50,"score":8},{"conversion_gt":0.40,"score":4}],"cumulative":true}','จำนวนผู้สมัครทั้งหมด จำนวนที่เติมจริง และวิธีคำนวณจากแหล่งข้อมูลเดียวกัน',302),
 ('4.1','4','วินัยและมาตรฐานความเป็นผู้นำ','ระเบียบและค่านิยมองค์กร','ปฏิบัติตามระเบียบบริษัทและค่านิยมองค์กร เป็นตัวอย่างให้ทีมได้',2,'{}','บันทึกการปฏิบัติงานหรือคำรับรองของผู้ประเมิน',401),
 ('4.2','4','วินัยและมาตรฐานความเป็นผู้นำ','การขาดงาน','ไม่เคยขาดงานในรอบประเมิน',3,'{}','ข้อมูลเวลาเข้างาน/การลาในรอบประเมิน',402),
 ('4.3','4','วินัยและมาตรฐานความเป็นผู้นำ','การมาสาย','ไม่เคยมาสายในรอบประเมิน',3,'{}','ข้อมูลเวลาเข้างานในรอบประเมิน',403),
 ('4.4','4','วินัยและมาตรฐานความเป็นผู้นำ','ข้อร้องเรียน','ไม่เคยมีข้อร้องเรียนที่ยืนยันแล้วจากบุคคลอื่น',2,'{}','ทะเบียนข้อร้องเรียนและผลตรวจข้อเท็จจริง ห้ามใช้ข้อกล่าวหาที่ยังไม่ยืนยัน',404),
 ('5.1','5','การพัฒนาและต่อยอด','ปรับปรุงกระบวนการทำงาน','เสนอและดำเนินการปรับปรุง Process/SOP/Checklist ที่ลดขั้นตอน ข้อผิดพลาด เวลา หรือต้นทุนได้จริง',3,'{}','หลักฐานก่อน-หลังและผลลัพธ์ที่วัดได้',501),
 ('5.2','5','การพัฒนาและต่อยอด','พัฒนาเครื่องมือหรือระบบ','พัฒนาหรือร่วมพัฒนา Dashboard/Report/Automation/เครื่องมือควบคุมงานที่ทำให้ติดตามและตัดสินใจดีขึ้น',3,'{}','ลิงก์งาน เครื่องมือ หรือรายงาน พร้อมผลลัพธ์ก่อน-หลัง',502),
 ('5.3','5','การพัฒนาและต่อยอด','การเรียน E-learning','ให้คะแนนเมื่อมีหลักสูตรให้เรียนและเรียนครบทุกหลักสูตรเท่านั้น',2,'{}','รายชื่อหลักสูตรที่ได้รับมอบหมายและสถานะเรียนจบ',503),
 ('5.4','5','การพัฒนาและต่อยอด','ผลสอบ E-learning','ให้คะแนนเมื่อมีการสอบและคะแนนหลังเรียนทุกหลักสูตรตั้งแต่ 80% ขึ้นไป',2,'{}','ผลสอบจากระบบ E-learning',504),
 ('6','6','ผลงานพิเศษ','ผลงานพิเศษหรือโครงการ','งานนอกเหนือจากงานประจำที่แสดงผลลัพธ์วัดได้ เช่น ลดต้นทุน เวลา ข้อผิดพลาด เพิ่มประสิทธิภาพ หรือลดความเสี่ยง',4,'{}','ชื่อโครงการ บทบาท ผลก่อน-หลัง และหลักฐานยืนยันผล',600)
) as v(item_code,category_code,category_name,name,criteria,max_score,rubric,evidence_requirements,sort_order)
on conflict(scorecard_code,item_code) do update set category_code=excluded.category_code,category_name=excluded.category_name,name=excluded.name,criteria=excluded.criteria,max_score=excluded.max_score,rubric=excluded.rubric,evidence_requirements=excluded.evidence_requirements,sort_order=excluded.sort_order;

-- Staff-specific work and service quality.
insert into public.kpi_scorecard_items(scorecard_code,item_code,category_code,category_name,name,criteria,max_score,rubric,evidence_requirements,sort_order) values
('ADMIN-STAFF-2026','1.1','1','งานหลักประจำแผนก','ความถูกต้องในการทำรายการทางการเงิน','ตรวจชื่อ บัญชี จำนวนเงิน และข้อมูลก่อนยืนยัน ห้ามโอนผิดบัญชี ผิดจำนวน หรือทำซ้ำ; พบ 1 ครั้งในรอบ = 0',5,'{"knockout":"confirmed_transaction_error>=1"}','รายการธุรกรรมที่ตรวจและทะเบียนข้อผิดพลาดที่ยืนยันแล้ว',101),
('ADMIN-STAFF-2026','1.2','1','งานหลักประจำแผนก','ความถูกต้องของข้อมูลและการทำรายการ','บันทึก แก้ไข และตรวจข้อมูลลูกค้าครบถ้วน; พบตกหล่นหรือผิดพลาด 1 ครั้งในรอบ = 0',5,'{"knockout":"confirmed_data_error>=1"}','รายการที่รับผิดชอบและทะเบียนข้อผิดพลาดที่ยืนยันแล้ว',102),
('ADMIN-STAFF-2026','1.3','1','งานหลักประจำแผนก','ความพร้อมช่องทางหลักและรับมือเหตุขัดข้อง','นำช่องทางสำรองขึ้นตามขั้นตอนเมื่อช่องทางหลักมีปัญหา; แก้ช้ากว่า 5 นาที = 0',5,'{"knockout":"recovery_minutes>5"}','Incident เวลาเริ่ม-รับทราบ-กู้คืน และขั้นตอนช่องทางสำรอง',103),
('ADMIN-STAFF-2026','1.4','1','งานหลักประจำแผนก','ตรวจสอบความผิดปกติของธุรกรรม/การเดิมพัน','ตรวจพบพฤติกรรมผิดปกติ ตรวจสาเหตุ และส่งต่อผู้เชี่ยวชาญทันเวลา',3,'{}','เคสผิดปกติ ผลตรวจ และเวลาส่งต่อ',104),
('ADMIN-STAFF-2026','1.5','1','งานหลักประจำแผนก','แก้ไขและส่งต่อปัญหาอย่างถูกต้อง','แก้ปัญหาในขอบเขตตนเอง และส่งต่อพร้อมข้อมูล/หลักฐานครบเมื่อเกินหน้าที่',3,'{}','เคส วิธีแก้ ผู้รับช่วง และหลักฐานส่งต่อ',105),
('ADMIN-STAFF-2026','1.6','1','งานหลักประจำแผนก','ส่งมอบงานระหว่างกะ','ส่งต่อเคสค้าง ปัญหา งานติดตาม และข้อมูลสำคัญให้กะถัดไปครบถ้วน',3,'{}','บันทึก Handover ที่มีผู้รับและเวลา',106),
('ADMIN-STAFF-2026','1.7','1','งานหลักประจำแผนก','ความพร้อมและวินัยในการปฏิบัติงาน','Login-out/VPN ระบบและอุปกรณ์พร้อมก่อน ระหว่าง และหลังงานตามระเบียบ',3,'{}','Login/VPN/Checklist ความพร้อม',107),
('ADMIN-STAFF-2026','1.8','1','งานหลักประจำแผนก','ความรับผิดชอบ การติดตาม และปิดงาน','ติดตามเคสจนเรียบร้อย ไม่ปล่อยลูกค้าหรือเคสสำคัญค้างโดยไม่มีการติดตาม',3,'{}','รายการเคส สถานะ การอัปเดต และเวลาปิด',108),
('ADMIN-STAFF-2026','2.1','2','คุณภาพในการให้บริการ','ความรวดเร็วในการตอบลูกค้า','ตอบข้อความแรกลูกค้าภายใน 3 นาที; ช้ากว่า 3 นาทีตั้งแต่ 2 ครั้งในรอบ = 0',9,'{"knockout":"first_response_over_3_minutes>=2"}','สถิติเวลาตอบครั้งแรกพร้อมจำนวนเคสทั้งหมด',201),
('ADMIN-STAFF-2026','2.2','2','คุณภาพในการให้บริการ','คุณภาพการสื่อสารและถ้อยคำ','สุภาพ ชัดเจน ถูกต้อง เหมาะสม ไม่ก่อความเข้าใจผิดหรือเสียภาพลักษณ์; ผิดยืนยัน 1 ครั้ง = 0',9,'{"knockout":"confirmed_communication_breach>=1"}','ตัวอย่างแชท/ผล QC และผลยืนยันข้อเท็จจริง',202),
('ADMIN-STAFF-2026','2.3','2','คุณภาพในการให้บริการ','ควบคุมมาตรฐานการปฏิบัติงาน','ทำตาม Checklist, SOP และมาตรฐานรายวัน/รายเดือนครบถ้วน',4,'{}','Checklist และ SOP ที่ลงชื่อ/เวลาแล้ว',203)
on conflict(scorecard_code,item_code) do update set category_name=excluded.category_name,name=excluded.name,criteria=excluded.criteria,max_score=excluded.max_score,rubric=excluded.rubric,evidence_requirements=excluded.evidence_requirements,sort_order=excluded.sort_order;

-- Lead scorecard: deputy, assistant head and head share one standard.
insert into public.kpi_scorecard_items(scorecard_code,item_code,category_code,category_name,name,criteria,max_score,rubric,evidence_requirements,sort_order) values
('ADMIN-LEAD-2026','1.1','1','งานหลักประจำแผนก','ควบคุมยอดเงินและวงเงินฝาก-ถอน','บริหารยอดเงิน/วงเงินให้พอต่อการฝากถอน และจัดวงเงินใกล้เต็มหรือเต็มตามเวลาที่กำหนด; ปัญหาแก้เกิน 10 นาที = 0',5,'{"components":[3,2],"knockout":"confirmed_recovery_minutes>10"}','รายงานยอด/วงเงิน การแจ้งเตือน และเวลาแก้ไข',101),
('ADMIN-LEAD-2026','1.2','1','งานหลักประจำแผนก','ความถูกต้องและความเป็นปัจจุบันของข้อมูล','ข้อมูล PM/P2P/บัญชีและสถานะระบบถูกต้อง อัปเดตทันเวลา และแจ้งผู้เกี่ยวข้องครบ',4,'{"components":[2,2]}','รายงานสถานะ เวลาปรับปรุง และผู้รับแจ้ง',102),
('ADMIN-LEAD-2026','1.3','1','งานหลักประจำแผนก','เตรียมความพร้อมระบบ','วางแผนให้ระบบรองรับลูกค้าได้ต่อเนื่อง ลดปัญหาที่ป้องกันล่วงหน้าได้',2,'{}','แผนความพร้อม/Capacity/ช่องทางสำรอง',103),
('ADMIN-LEAD-2026','1.4','1','งานหลักประจำแผนก','ความพร้อมช่องทางหลักและเหตุขัดข้อง','นำช่องทางสำรองขึ้นตามขั้นตอน; แก้ช้ากว่า 5 นาที = 0',2,'{"knockout":"recovery_minutes>5"}','Incident และ Timeline การกู้คืน',104),
('ADMIN-LEAD-2026','1.5','1','งานหลักประจำแผนก','ส่งต่องานระหว่างกะ','ส่งต่อปัญหา รายการติดตาม ยอดเงิน วงเงิน และงานค้างครบถ้วน',2,'{}','Handover พร้อมผู้รับผิดชอบและกำหนดเวลา',105),
('ADMIN-LEAD-2026','1.6','1','งานหลักประจำแผนก','ตรวจสอบธุรกรรม/การเดิมพันผิดปกติ','ตรวจสาเหตุและส่งต่อผู้เชี่ยวชาญตามลำดับทันเวลา',2,'{}','เคสผิดปกติ ผลตรวจ และเวลาส่งต่อ',106),
('ADMIN-LEAD-2026','1.7','1','งานหลักประจำแผนก','วิเคราะห์สาเหตุ แก้ไข และป้องกันซ้ำ','กำหนดแนวทาง ผู้รับผิดชอบ และติดตามผล; ปัญหาป้องกันได้เกิดซ้ำเกิน 3 ครั้ง = 0',2,'{"knockout":"preventable_repeat>3"}','RCA, Action, Owner, Due date และผลติดตาม',107),
('ADMIN-LEAD-2026','1.8','1','งานหลักประจำแผนก','ประสานงานและติดตามผลข้ามแผนก','ติดตามจนได้ข้อสรุป ไม่ปล่อยปัญหาค้างเพราะเป็นหน้าที่แผนกอื่น',2,'{}','Timeline การประสานงานและข้อสรุป',108),
('ADMIN-LEAD-2026','1.9','1','งานหลักประจำแผนก','คุณภาพการตัดสินใจและจัดการสถานการณ์','ตัดสินใจตามผลกระทบ ความเสี่ยง ต้นทุน ความเร่งด่วน และส่งต่อเมื่อเกินอำนาจ',2,'{}','บันทึกการตัดสินใจ เหตุผล และผลลัพธ์',109),
('ADMIN-LEAD-2026','1.10','1','งานหลักประจำแผนก','จัดลำดับความสำคัญและบริหารทรัพยากร','ประเมินความเร่งด่วน/ผลกระทบ จัดงานก่อนหลังและจัดสรรคนเหมาะสม',2,'{}','แผนงาน ลำดับความสำคัญ และการจัดคน',110),
('ADMIN-LEAD-2026','1.11','1','งานหลักประจำแผนก','ควบคุมงานค้างและส่งมอบงาน','งานไม่เสร็จต้องมีสถานะ ผู้รับผิดชอบ และกำหนดเวลา',1,'{}','รายการงานค้างพร้อม Owner และ Due date',111),
('ADMIN-LEAD-2026','1.12','1','งานหลักประจำแผนก','คุณภาพข้อมูลประชาสัมพันธ์/ภาพลักษณ์','ตรวจความถูกต้องและความเหมาะสมก่อนเผยแพร่; ผิดพลาดหรือใช้ข้อมูลไม่ถูกต้อง 1 ครั้ง = 0',2,'{"knockout":"confirmed_publication_error>=1"}','ชิ้นงานอนุมัติ ผู้ตรวจ และเวอร์ชันเผยแพร่',112),
('ADMIN-LEAD-2026','1.13','1','งานหลักประจำแผนก','สรุปภาพรวมและข้อเสนอแนะสำหรับทีมบริหาร','สรุปตัวเลข แนวโน้ม ต้นทุน ปัญหา ความเสี่ยง ผลกระทบ และเรื่องต้องตัดสินใจได้ถูกต้องทันเวลา',2,'{}','รายงานบริหารและเวลาส่ง',113),
('ADMIN-LEAD-2026','2.1','2','การบริหารทีมและควบคุมคุณภาพ','วางแผนกำลังคนและกระจายงาน','จัดจำนวนคนเหมาะกับงาน กำหนดผู้รับผิดชอบและกระจายงานสมดุล',5,'{}','แผนกะ/ภาระงานรายคนและงานค้าง',201),
('ADMIN-LEAD-2026','2.2','2','การบริหารทีมและควบคุมคุณภาพ','ควบคุมความผิดพลาดของทีม','พนักงานที่ผิดพลาดเกิน 50% ของจำนวนทีม = 0 คะแนน',5,'{"knockout":"staff_with_error_ratio>0.50"}','รายชื่อทีม จำนวนผู้ผิดพลาด และเคสยืนยัน',202),
('ADMIN-LEAD-2026','2.3','2','การบริหารทีมและควบคุมคุณภาพ','ควบคุมความรวดเร็วในการตอบ','พนักงานตอบแชทช้าเกิน 3 นาทีในความควบคุม; ถ้าช้า 3 นาทีมากกว่า 50% ของทีม = 0',3,'{"knockout":"slow_staff_ratio>0.50"}','สถิติเวลาตอบแยกรายคนและจำนวนทีม',203),
('ADMIN-LEAD-2026','2.4','2','การบริหารทีมและควบคุมคุณภาพ','ติดตามสถานะและความพร้อมของทีม','พนักงานไม่ Login หรือหาย ต้องติดตามสาเหตุทันที',3,'{}','Login/VPN และบันทึกติดตาม',204),
('ADMIN-LEAD-2026','2.5','2','การบริหารทีมและควบคุมคุณภาพ','Coaching และพัฒนาจากข้อผิดพลาด','อธิบายวิธีที่ถูกต้องและติดตามผลหลัง Coaching',3,'{}','บันทึก Coaching ประเด็น วันติดตาม และผล',205),
('ADMIN-LEAD-2026','2.6','2','การบริหารทีมและควบคุมคุณภาพ','ควบคุมมาตรฐานการปฏิบัติงาน','ทีมทำตาม Checklist, SOP และมาตรฐานรายวัน/รายเดือนครบถ้วน',3,'{}','Checklist/SOP ของทีมและผลสุ่มตรวจ',206)
on conflict(scorecard_code,item_code) do update set category_name=excluded.category_name,name=excluded.name,criteria=excluded.criteria,max_score=excluded.max_score,rubric=excluded.rubric,evidence_requirements=excluded.evidence_requirements,sort_order=excluded.sort_order;

-- Management Admin work and team-control sections.
insert into public.kpi_scorecard_items(scorecard_code,item_code,category_code,category_name,name,criteria,max_score,rubric,evidence_requirements,sort_order) values
('ADMIN-MGMT-2026','1.1','1','งานหลักประจำแผนก','บริหารสภาพคล่องและความต่อเนื่อง','บริหารยอดเงินและช่องทางให้เพียงพอ ตรวจสถานะและจัดการปัญหา; ปัญหาแก้เกิน 10 นาที = 0',5,'{"knockout":"confirmed_recovery_minutes>10"}','รายงานสภาพคล่อง ช่องทางสำรอง Incident และ Timeline',101),
('ADMIN-MGMT-2026','1.2','1','งานหลักประจำแผนก','ความถูกต้องและความเป็นปัจจุบันของข้อมูล','ข้อมูล PM/P2P/บัญชีและสถานะระบบถูกต้องและอัปเดตทันเวลา',2,'{}','รายงานสถานะและเวลาอัปเดต',102),
('ADMIN-MGMT-2026','1.3','1','งานหลักประจำแผนก','วิเคราะห์แนวโน้มและสถานการณ์ลูกค้า','วิเคราะห์ลูกค้าที่เพิ่ม/ลด สาเหตุ จุดผิดปกติ กลุ่มกระทบ และแนวทางแก้',2,'{}','รายงานแนวโน้มพร้อมฐานข้อมูลและข้อเสนอ',103),
('ADMIN-MGMT-2026','1.4','1','งานหลักประจำแผนก','ตรวจสอบธุรกรรม/การเดิมพันผิดปกติ','ตรวจสาเหตุและส่งต่อผู้เชี่ยวชาญตามลำดับทันเวลา',2,'{}','เคสผิดปกติ ผลตรวจ และเวลาส่งต่อ',104),
('ADMIN-MGMT-2026','1.5','1','งานหลักประจำแผนก','ควบคุมและเพิ่มประสิทธิภาพต้นทุน','วิเคราะห์ต้นทุน PM/P2P/บัญชีเทียบปริมาณ ตรวจต้นทุนผิดปกติและลดต้นทุนโดยไม่ลดคุณภาพ',2,'{}','ต้นทุน/ปริมาณก่อน-หลังและข้อเสนอ',105),
('ADMIN-MGMT-2026','1.6','1','งานหลักประจำแผนก','ความพร้อมและความต่อเนื่องของระบบ','เตรียมช่องทางสำรองและแผนรองรับ ลดเหตุบริการสะดุดที่ป้องกันล่วงหน้าได้',2,'{}','แผน BCP/ช่องทางสำรองและผลทดสอบ',106),
('ADMIN-MGMT-2026','1.7','1','งานหลักประจำแผนก','วิเคราะห์สาเหตุ แก้ไข และป้องกันซ้ำ','มี RCA แนวทาง ผู้รับผิดชอบ และติดตามผล; ปัญหาป้องกันได้ซ้ำเกิน 3 ครั้ง = 0',2,'{"knockout":"preventable_repeat>3"}','RCA, Action, Owner, Due date และผลติดตาม',107),
('ADMIN-MGMT-2026','1.8','1','งานหลักประจำแผนก','ประสานงานและติดตามผลข้ามแผนก','ติดตามจนได้ข้อสรุป ไม่ปล่อยงานค้างเพราะเป็นหน้าที่แผนกอื่น',2,'{}','Timeline การประสานงานและข้อสรุป',108),
('ADMIN-MGMT-2026','1.9','1','งานหลักประจำแผนก','คุณภาพการตัดสินใจและจัดการสถานการณ์','ตัดสินใจตามผลกระทบ ความเสี่ยง ต้นทุน ความเร่งด่วน และส่งต่อบอร์ดเมื่อเกินอำนาจ',2,'{}','Decision log และผลลัพธ์',109),
('ADMIN-MGMT-2026','1.10','1','งานหลักประจำแผนก','จัดลำดับความสำคัญและบริหารทรัพยากร','จัดลำดับงานและจัดสรรคน/ทรัพยากรให้สอดคล้องสถานการณ์',2,'{}','แผนงาน ลำดับความสำคัญ และการจัดสรร',110),
('ADMIN-MGMT-2026','1.11','1','งานหลักประจำแผนก','ควบคุมงานค้างและส่งมอบงาน','งานไม่เสร็จต้องมีสถานะ ผู้รับผิดชอบ และกำหนดเวลา',2,'{}','รายการงานค้างพร้อม Owner/Due date',111),
('ADMIN-MGMT-2026','1.12','1','งานหลักประจำแผนก','บริหารผลลัพธ์ของทีม','ควบคุมผลการดำเนินงานของทีมให้เป็นไปตามเป้าหมาย',2,'{}','เป้าหมาย ผลจริง ความต่าง และ Action',112),
('ADMIN-MGMT-2026','1.13','1','งานหลักประจำแผนก','สรุปภาพรวมและข้อเสนอแนะสำหรับบอร์ดบริหาร','สรุปตัวเลข แนวโน้มลูกค้า ต้นทุน ปัญหา ความเสี่ยง ผลกระทบและเรื่องต้องตัดสินใจอย่างถูกต้องทันเวลา',3,'{}','รายงานบอร์ดและเวลาส่ง',113),
('ADMIN-MGMT-2026','2.1','2','การบริหารทีมและควบคุมคุณภาพ','วางแผนกำลังคนและกระจายงานภาพรวม','จัดคนเหมาะสม กำหนด Owner กระจายงานสมดุล ลด Single point of failure',5,'{}','แผนกำลังคน ภาระงาน และความเสี่ยง',201),
('ADMIN-MGMT-2026','2.2','2','การบริหารทีมและควบคุมคุณภาพ','ควบคุมคุณภาพและความผิดพลาดของทีม','พนักงานที่ผิดพลาดมากกว่า 30% ของทีม = 0 คะแนน',5,'{"knockout":"staff_with_error_ratio>0.30"}','จำนวนทีม ผู้ผิดพลาด และเคสยืนยัน',202),
('ADMIN-MGMT-2026','2.3','2','การบริหารทีมและควบคุมคุณภาพ','ความพร้อมก่อนเริ่มงานและตลอดเวลาปฏิบัติงาน','ควบคุม Login/VPN/ระบบ/อุปกรณ์ให้พร้อม',3,'{}','รายงานความพร้อมของทีม',203),
('ADMIN-MGMT-2026','2.4','2','การบริหารทีมและควบคุมคุณภาพ','ติดตามสถานะและความพร้อมของทีม','พนักงานไม่ Login/หาย/ไม่พร้อม ต้องติดตามสาเหตุทันที',3,'{}','บันทึกติดตามและการแก้ไข',204),
('ADMIN-MGMT-2026','2.5','2','การบริหารทีมและควบคุมคุณภาพ','Coaching และพัฒนาจากข้อผิดพลาด','อธิบายวิธีที่ถูกต้องและติดตามผลหลัง Coaching',3,'{}','บันทึก Coaching และผลติดตาม',205),
('ADMIN-MGMT-2026','2.6','2','การบริหารทีมและควบคุมคุณภาพ','ควบคุมมาตรฐานการปฏิบัติงาน','ทีมทำตาม Checklist, SOP และมาตรฐานรายวัน/รายเดือนครบถ้วน',3,'{}','Checklist/SOP ของทีมและผลสุ่มตรวจ',206)
on conflict(scorecard_code,item_code) do update set category_name=excluded.category_name,name=excluded.name,criteria=excluded.criteria,max_score=excluded.max_score,rubric=excluded.rubric,evidence_requirements=excluded.evidence_requirements,sort_order=excluded.sort_order;

insert into public.kpi_policy_notices(code,source_team,title,body,effective_from)
values('ADMIN-KPI-2026-10-11','ทีม KPI','เริ่มใช้เกณฑ์ KPI Admin มาตรฐาน ตั้งแต่ 11 ตุลาคม 2026',
'ใช้ KPI ตามระดับตำแหน่ง: พนักงาน Admin ประเมินโดยผู้ช่วยหัวหน้า/หัวหน้า; รองประเมินโดยผู้ช่วยหัวหน้า; ผู้ช่วยหัวหน้าประเมินโดยหัวหน้า; หัวหน้าประเมินโดยทีมบริหาร Admin; บริหารแอดมินประเมินโดยทีมบริหาร/ทีม KPI ทุกคะแนนต้องอ้างอิงผลงานจริงและมีหลักฐาน ห้ามบิดเบือนคะแนนหรือใช้ความสัมพันธ์ส่วนตัว หากพบความไม่โปร่งใสให้ผลประเมินเป็นโมฆะและประเมินใหม่โดยผู้เป็นกลาง การพิจารณาทางวินัยต้องผ่านการตรวจข้อเท็จจริง ไม่ดำเนินการอัตโนมัติจากคะแนน',
'2026-10-11')
on conflict(code) do update set body=excluded.body,effective_from=excluded.effective_from,active=true;

create or replace function public.kpi_admin_position_group(p_position text)
returns text language sql immutable as $$
 select case
  when lower(coalesce(p_position,'')) ~ '(บริหาร.*แอดมิน|admin management|management admin)' then 'management'
  when lower(coalesce(p_position,'')) ~ '(ผู้ช่วยหัวหน้า|รอง.*หัวหน้า|assistant.*(head|lead)|deput.*(head|lead)|หัวหน้า|head|lead)' then 'lead'
  else 'staff' end
$$;

create or replace function public.can_view_kpi_evaluation(p_evaluation uuid)
returns boolean language sql stable security definer set search_path=public as $$
 select exists(
  select 1 from public.kpi_evaluations e join public.profiles me on me.id=auth.uid() and me.active
  where e.id=p_evaluation and (
   e.evaluatee_id=auth.uid() or e.evaluator_id=auth.uid() or e.reviewer_id=auth.uid()
   or me.role in ('admin','exec')
   or (me.role='lead' and public.can_manage_department('ADMIN'))
   or (me.department_code='KPI' and me.role in ('lead','admin','exec'))
  )
 )
$$;

alter table public.kpi_scorecards enable row level security;
alter table public.kpi_scorecard_items enable row level security;
alter table public.kpi_evaluator_assignments enable row level security;
alter table public.kpi_evaluations enable row level security;
alter table public.kpi_evaluation_scores enable row level security;
alter table public.kpi_evaluation_comments enable row level security;
alter table public.kpi_evaluation_audit enable row level security;
alter table public.kpi_policy_notices enable row level security;
alter table public.kpi_policy_acknowledgements enable row level security;

drop policy if exists kpi_scorecards_read on public.kpi_scorecards;
create policy kpi_scorecards_read on public.kpi_scorecards for select to authenticated using(active);
drop policy if exists kpi_scorecard_items_read on public.kpi_scorecard_items;
create policy kpi_scorecard_items_read on public.kpi_scorecard_items for select to authenticated using(exists(select 1 from public.kpi_scorecards s where s.code=scorecard_code and s.active));
drop policy if exists kpi_evaluator_assignments_read on public.kpi_evaluator_assignments;
create policy kpi_evaluator_assignments_read on public.kpi_evaluator_assignments for select to authenticated using(evaluatee_id=auth.uid() or evaluator_id=auth.uid() or reviewer_id=auth.uid() or public.can_manage_department('ADMIN'));
drop policy if exists kpi_evaluations_read on public.kpi_evaluations;
create policy kpi_evaluations_read on public.kpi_evaluations for select to authenticated using(public.can_view_kpi_evaluation(id));
drop policy if exists kpi_evaluation_scores_read on public.kpi_evaluation_scores;
create policy kpi_evaluation_scores_read on public.kpi_evaluation_scores for select to authenticated using(public.can_view_kpi_evaluation(evaluation_id));
drop policy if exists kpi_evaluation_comments_read on public.kpi_evaluation_comments;
create policy kpi_evaluation_comments_read on public.kpi_evaluation_comments for select to authenticated using(public.can_view_kpi_evaluation(evaluation_id));
drop policy if exists kpi_evaluation_audit_read on public.kpi_evaluation_audit;
create policy kpi_evaluation_audit_read on public.kpi_evaluation_audit for select to authenticated using(public.can_view_kpi_evaluation(evaluation_id));
drop policy if exists kpi_policy_notices_read on public.kpi_policy_notices;
create policy kpi_policy_notices_read on public.kpi_policy_notices for select to authenticated using(active);
drop policy if exists kpi_policy_ack_read on public.kpi_policy_acknowledgements;
create policy kpi_policy_ack_read on public.kpi_policy_acknowledgements for select to authenticated using(profile_id=auth.uid() or public.can_manage_department('ADMIN'));

create or replace function public.start_admin_kpi_evaluation(p_evaluatee uuid,p_period_start date)
returns public.kpi_evaluations language plpgsql security definer set search_path=public as $$
declare target public.profiles;assignment public.kpi_evaluator_assignments;card text;ending date;out_row public.kpi_evaluations;
begin
 if not public.my_company_credentials_ready() then raise exception 'บัญชียังไม่พร้อม';end if;
 select * into target from public.profiles where id=p_evaluatee and active and department_code='ADMIN';
 if target.id is null then raise exception 'ไม่พบพนักงาน Admin ที่ใช้งานอยู่';end if;
 if p_evaluatee=auth.uid() then raise exception 'ไม่อนุญาตให้ประเมินตนเอง';end if;
 if p_period_start is null or extract(day from p_period_start)<>1 or p_period_start>(now() at time zone 'Asia/Bangkok')::date then raise exception 'รอบเดือนไม่ถูกต้อง';end if;
 select * into assignment from public.kpi_evaluator_assignments a where a.evaluatee_id=p_evaluatee and a.effective_from<=p_period_start and (a.effective_to is null or a.effective_to>=p_period_start) order by a.effective_from desc limit 1;
 if assignment.id is not null and assignment.evaluator_id<>auth.uid() and not public.can_manage_department('ADMIN') then raise exception 'คุณไม่ใช่ผู้ประเมินที่ได้รับมอบหมาย';end if;
 if assignment.id is null and not public.can_manage_department('ADMIN') then raise exception 'ยังไม่ได้กำหนดผู้ประเมิน';end if;
 card:=coalesce(assignment.scorecard_code,case public.kpi_admin_position_group(target.position_title) when 'management' then 'ADMIN-MGMT-2026' when 'lead' then 'ADMIN-LEAD-2026' else 'ADMIN-STAFF-2026' end);
 ending:=(p_period_start+interval '1 month - 1 day')::date;
 select * into out_row from public.kpi_evaluations where evaluatee_id=p_evaluatee and scorecard_code=card and period_start=p_period_start and status<>'voided' limit 1;
 if out_row.id is not null then return out_row;end if;
 insert into public.kpi_evaluations(evaluatee_id,scorecard_code,period_start,period_end,evaluator_id,reviewer_id)
 values(p_evaluatee,card,p_period_start,ending,coalesce(assignment.evaluator_id,auth.uid()),assignment.reviewer_id) returning * into out_row;
 insert into public.kpi_evaluation_audit(evaluation_id,actor_id,event_type,after_row) values(out_row.id,auth.uid(),'created',to_jsonb(out_row));
 return out_row;
end $$;

create or replace function public.set_admin_kpi_assignment(p_evaluatee uuid,p_evaluator uuid,p_reviewer uuid,p_scorecard text,p_effective_from date)
returns public.kpi_evaluator_assignments language plpgsql security definer set search_path=public as $$
declare me public.profiles;target public.profiles;out_row public.kpi_evaluator_assignments;card text;
begin
 select * into me from public.profiles where id=auth.uid() and active;
 select * into target from public.profiles where id=p_evaluatee and active and department_code='ADMIN';
 if target.id is null or not exists(select 1 from public.profiles where id=p_evaluator and active) then raise exception 'ไม่พบบัญชีผู้รับการประเมินหรือผู้ประเมิน';end if;
 if not (me.role in ('admin','exec') or (me.department_code='KPI' and me.role in ('lead','admin','exec'))) then raise exception 'เฉพาะทีมบริหารหรือทีม KPI ที่กำหนดสายผู้ประเมินได้';end if;
 if p_evaluatee=p_evaluator or p_evaluator=p_reviewer or p_evaluatee=p_reviewer then raise exception 'ผู้ประเมิน ผู้รับการประเมิน และผู้ตรวจรับต้องเป็นคนละคน';end if;
 if p_reviewer is not null and not exists(select 1 from public.profiles where id=p_reviewer and active) then raise exception 'ไม่พบผู้ตรวจรับ';end if;
 if p_effective_from is null or extract(day from p_effective_from)<>1 then raise exception 'วันเริ่มใช้ต้องเป็นวันแรกของเดือน';end if;
 card:=coalesce(nullif(p_scorecard,''),case public.kpi_admin_position_group(target.position_title) when 'management' then 'ADMIN-MGMT-2026' when 'lead' then 'ADMIN-LEAD-2026' else 'ADMIN-STAFF-2026' end);
 if not exists(select 1 from public.kpi_scorecards where code=card and active) then raise exception 'ไม่พบชุด KPI';end if;
 insert into public.kpi_evaluator_assignments(evaluatee_id,scorecard_code,evaluator_id,reviewer_id,effective_from,created_by)
 values(p_evaluatee,card,p_evaluator,p_reviewer,p_effective_from,auth.uid())
 on conflict(evaluatee_id,effective_from) do update set scorecard_code=excluded.scorecard_code,evaluator_id=excluded.evaluator_id,reviewer_id=excluded.reviewer_id,created_by=auth.uid(),created_at=now()
 returning * into out_row;return out_row;
end $$;

create or replace function public.save_admin_kpi_draft(p_evaluation uuid,p_scores jsonb,p_note text,p_expected_version integer)
returns public.kpi_evaluations language plpgsql security definer set search_path=public as $$
declare e public.kpi_evaluations;entry jsonb;item public.kpi_scorecard_items;out_row public.kpi_evaluations;before_row jsonb;total numeric;bad_url text;
begin
 if jsonb_typeof(p_scores)<>'array' or p_expected_version is null then raise exception 'ข้อมูลคะแนนไม่ถูกต้อง';end if;
 select * into e from public.kpi_evaluations where id=p_evaluation for update;
 if e.id is null then raise exception 'ไม่พบผลประเมิน';end if;
 if e.evaluator_id<>auth.uid() then raise exception 'ไม่มีสิทธิ์แก้ผลประเมิน';end if;
 if e.status not in ('draft','returned') then raise exception 'ผลประเมินถูกส่งแล้ว ไม่สามารถแก้ไขได้';end if;
 if e.version<>p_expected_version then raise exception 'ผลประเมินมีการแก้ไขแล้ว กรุณาโหลดใหม่ (ปัจจุบัน % / ที่ส่งมา %)',e.version,p_expected_version;end if;
 before_row:=to_jsonb(e);delete from public.kpi_evaluation_scores where evaluation_id=e.id;
 for entry in select value from jsonb_array_elements(p_scores) loop
  select * into item from public.kpi_scorecard_items where id=(entry->>'item_id')::uuid and scorecard_code=e.scorecard_code;
  if item.id is null or (entry->>'score') is null or (entry->>'score')::numeric<0 or (entry->>'score')::numeric>item.max_score then raise exception 'คะแนนอยู่นอกเกณฑ์ของตัวชี้วัด';end if;
  if jsonb_typeof(coalesce(entry->'evidence_urls','[]'::jsonb))<>'array' then raise exception 'รูปแบบลิงก์หลักฐานไม่ถูกต้อง';end if;
  select value #>> '{}' into bad_url from jsonb_array_elements(coalesce(entry->'evidence_urls','[]'::jsonb)) where value #>> '{}' !~* '^https?://[^[:space:]]+$' limit 1;
  if bad_url is not null then raise exception 'ลิงก์หลักฐานต้องเริ่มด้วย http:// หรือ https://';end if;
  insert into public.kpi_evaluation_scores(evaluation_id,item_id,score,evidence_note,evidence_urls)
  values(e.id,item.id,(entry->>'score')::numeric,left(trim(coalesce(entry->>'evidence_note','')),10000),coalesce(entry->'evidence_urls','[]'::jsonb));
 end loop;
 select coalesce(sum(score),0) into total from public.kpi_evaluation_scores where evaluation_id=e.id;
 update public.kpi_evaluations set evaluator_note=left(trim(coalesce(p_note,'')),10000),total_score=total,grade=null,return_reason='',status='draft',version=version+1,updated_at=now() where id=e.id returning * into out_row;
 insert into public.kpi_evaluation_audit(evaluation_id,actor_id,event_type,before_row,after_row) values(e.id,auth.uid(),'draft_saved',before_row,to_jsonb(out_row));
 return out_row;
end $$;

create or replace function public.submit_admin_kpi_evaluation(p_evaluation uuid,p_expected_version integer)
returns public.kpi_evaluations language plpgsql security definer set search_path=public as $$
declare e public.kpi_evaluations;missing integer;bad_evidence integer;total numeric;out_row public.kpi_evaluations;
begin
 select * into e from public.kpi_evaluations where id=p_evaluation for update;
 if e.id is null or e.evaluator_id<>auth.uid() or e.status<>'draft' or e.version<>p_expected_version then raise exception 'ไม่สามารถส่งผลประเมิน กรุณาโหลดใหม่';end if;
 select count(*) into missing from public.kpi_scorecard_items i where i.scorecard_code=e.scorecard_code and not exists(select 1 from public.kpi_evaluation_scores s where s.evaluation_id=e.id and s.item_id=i.id);
 select count(*) into bad_evidence from public.kpi_evaluation_scores s where s.evaluation_id=e.id and char_length(trim(s.evidence_note))<10 and jsonb_array_length(s.evidence_urls)=0;
 if missing>0 then raise exception 'ยังให้คะแนนไม่ครบ % รายการ',missing;end if;
 if bad_evidence>0 then raise exception 'ยังขาดหลักฐาน % รายการ',bad_evidence;end if;
 select sum(score) into total from public.kpi_evaluation_scores where evaluation_id=e.id;
 update public.kpi_evaluations set status='submitted',total_score=total,grade=case when total>=90 then 'A' when total>=80 then 'B' when total>=70 then 'C' else 'D' end,submitted_at=now(),version=version+1,updated_at=now() where id=e.id returning * into out_row;
 insert into public.kpi_evaluation_audit(evaluation_id,actor_id,event_type,before_row,after_row) values(e.id,auth.uid(),'submitted',to_jsonb(e),to_jsonb(out_row));
 return out_row;
end $$;

create or replace function public.review_admin_kpi_evaluation(p_evaluation uuid,p_action text,p_reason text,p_expected_version integer)
returns public.kpi_evaluations language plpgsql security definer set search_path=public as $$
declare e public.kpi_evaluations;me public.profiles;out_row public.kpi_evaluations;
begin
 select * into e from public.kpi_evaluations where id=p_evaluation for update;select * into me from public.profiles where id=auth.uid() and active;
 if e.id is null or e.status<>'submitted' or e.version<>p_expected_version then raise exception 'ผลประเมินไม่อยู่ในสถานะตรวจรับ';end if;
 if e.evaluator_id=auth.uid() then raise exception 'ผู้ประเมินห้ามอนุมัติผลของตนเอง';end if;
 if not (e.reviewer_id=auth.uid() or me.role in ('admin','exec') or (me.department_code='KPI' and me.role in ('lead','admin','exec'))) then raise exception 'ไม่มีสิทธิ์ตรวจรับผลประเมิน';end if;
 if p_action='return' then
  if char_length(trim(coalesce(p_reason,'')))<10 then raise exception 'กรุณาระบุเหตุผลส่งกลับอย่างน้อย 10 ตัวอักษร';end if;
  update public.kpi_evaluations set status='returned',return_reason=left(trim(p_reason),3000),version=version+1,updated_at=now() where id=e.id returning * into out_row;
 elsif p_action='approve' then
  update public.kpi_evaluations set status='approved',reviewer_id=auth.uid(),approved_at=now(),return_reason='',version=version+1,updated_at=now() where id=e.id returning * into out_row;
 else raise exception 'คำสั่งตรวจรับไม่ถูกต้อง';end if;
 insert into public.kpi_evaluation_audit(evaluation_id,actor_id,event_type,before_row,after_row,reason) values(e.id,auth.uid(),case when p_action='return' then 'returned' else 'approved' end,to_jsonb(e),to_jsonb(out_row),coalesce(p_reason,''));
 return out_row;
end $$;

create or replace function public.void_admin_kpi_evaluation(p_evaluation uuid,p_reason text,p_expected_version integer)
returns public.kpi_evaluations language plpgsql security definer set search_path=public as $$
declare e public.kpi_evaluations;me public.profiles;out_row public.kpi_evaluations;
begin
 select * into e from public.kpi_evaluations where id=p_evaluation for update;select * into me from public.profiles where id=auth.uid() and active;
 if e.id is null or e.status='voided' or e.version<>p_expected_version then raise exception 'ผลประเมินเปลี่ยนแปลงแล้ว กรุณาโหลดใหม่';end if;
 if not (me.role in ('admin','exec') or (me.department_code='KPI' and me.role in ('lead','admin','exec'))) then raise exception 'เฉพาะทีมบริหารหรือทีม KPI เท่านั้นที่ทำผลเป็นโมฆะได้';end if;
 if char_length(trim(coalesce(p_reason,'')))<20 then raise exception 'กรุณาระบุข้อเท็จจริงและเหตุผลอย่างน้อย 20 ตัวอักษร';end if;
 update public.kpi_evaluations set status='voided',total_score=null,grade=null,void_reason=left(trim(p_reason),3000),voided_at=now(),version=version+1,updated_at=now() where id=e.id returning * into out_row;
 insert into public.kpi_evaluation_audit(evaluation_id,actor_id,event_type,before_row,after_row,reason) values(e.id,auth.uid(),'voided',to_jsonb(e),to_jsonb(out_row),p_reason);
 return out_row;
end $$;

create or replace function public.comment_admin_kpi_evaluation(p_evaluation uuid,p_body text)
returns public.kpi_evaluation_comments language plpgsql security definer set search_path=public as $$
declare out_row public.kpi_evaluation_comments;
begin
 if not public.can_view_kpi_evaluation(p_evaluation) or char_length(trim(coalesce(p_body,''))) not between 1 and 3000 then raise exception 'ไม่สามารถบันทึกความคิดเห็น';end if;
 insert into public.kpi_evaluation_comments(evaluation_id,author_id,body) values(p_evaluation,auth.uid(),trim(p_body)) returning * into out_row;return out_row;
end $$;

create or replace function public.acknowledge_kpi_policy(p_notice text)
returns void language plpgsql security definer set search_path=public as $$
begin
 if not exists(select 1 from public.kpi_policy_notices where code=p_notice and active) then raise exception 'ไม่พบประกาศ';end if;
 insert into public.kpi_policy_acknowledgements(notice_code,profile_id) values(p_notice,auth.uid()) on conflict do nothing;
end $$;

revoke insert,update,delete on public.kpi_scorecards,public.kpi_scorecard_items,public.kpi_evaluator_assignments,public.kpi_evaluations,public.kpi_evaluation_scores,public.kpi_evaluation_comments,public.kpi_evaluation_audit,public.kpi_policy_notices,public.kpi_policy_acknowledgements from authenticated;
grant select on public.kpi_scorecards,public.kpi_scorecard_items,public.kpi_evaluator_assignments,public.kpi_evaluations,public.kpi_evaluation_scores,public.kpi_evaluation_comments,public.kpi_evaluation_audit,public.kpi_policy_notices,public.kpi_policy_acknowledgements to authenticated;
revoke all on function public.start_admin_kpi_evaluation(uuid,date),public.set_admin_kpi_assignment(uuid,uuid,uuid,text,date),public.save_admin_kpi_draft(uuid,jsonb,text,integer),public.submit_admin_kpi_evaluation(uuid,integer),public.review_admin_kpi_evaluation(uuid,text,text,integer),public.void_admin_kpi_evaluation(uuid,text,integer),public.comment_admin_kpi_evaluation(uuid,text),public.acknowledge_kpi_policy(text) from public;
grant execute on function public.start_admin_kpi_evaluation(uuid,date),public.set_admin_kpi_assignment(uuid,uuid,uuid,text,date),public.save_admin_kpi_draft(uuid,jsonb,text,integer),public.submit_admin_kpi_evaluation(uuid,integer),public.review_admin_kpi_evaluation(uuid,text,text,integer),public.void_admin_kpi_evaluation(uuid,text,integer),public.comment_admin_kpi_evaluation(uuid,text),public.acknowledge_kpi_policy(text) to authenticated;

commit;
