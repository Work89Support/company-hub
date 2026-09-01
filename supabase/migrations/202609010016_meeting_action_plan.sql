-- Meeting action plan and reporting hierarchy for the September 2026 rollout.
-- This migration is intentionally independent from the Google Sheets import
-- pipeline (migrations 008-010/014 and prepare_google_activity_import.py).

alter table public.departments
  add column if not exists reporting_parent_code text references public.departments(code);

-- Graphic Production remains a distinct security/data department, but its
-- management report rolls up under Marketing.
update public.departments
set reporting_parent_code='MKT'
where code='GRAPHIC' and reporting_parent_code is distinct from 'MKT';

create table if not exists public.implementation_actions (
  id text primary key check (id ~ '^(AP|UAT)-[0-9]{2}$'),
  title text not null check (char_length(title) between 1 and 300),
  detail text not null default '',
  department_code text references public.departments(code),
  owner_label text not null default '',
  owner_user_id uuid references public.profiles(id) on delete set null,
  phase text not null default 'go_live',
  start_date date not null,
  due_date date not null,
  status text not null default 'not_started'
    check (status in ('not_started','in_progress','review','blocked','done')),
  priority text not null default 'high'
    check (priority in ('low','medium','high','critical')),
  success_measure text not null default '',
  evidence text not null default '',
  source_document text not null default 'รายงานระบบ Company Hub',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (due_date >= start_date)
);

create index if not exists implementation_actions_due_idx
  on public.implementation_actions(status,due_date);
create index if not exists implementation_actions_department_idx
  on public.implementation_actions(department_code,status);

create or replace function public.touch_implementation_action()
returns trigger language plpgsql set search_path=public as $$
begin
  new.updated_at=now();
  return new;
end
$$;

drop trigger if exists implementation_actions_touch on public.implementation_actions;
create trigger implementation_actions_touch before update on public.implementation_actions
for each row execute function public.touch_implementation_action();

alter table public.implementation_actions enable row level security;

drop policy if exists "management read implementation actions" on public.implementation_actions;
create policy "management read implementation actions" on public.implementation_actions
for select to authenticated using (
  public.is_access_admin()
  or exists(select 1 from public.profiles p where p.id=auth.uid() and p.active and p.role='lead')
    and department_code is not null
    and public.can_view_department(department_code)
);

drop policy if exists "management update implementation actions" on public.implementation_actions;
create policy "management update implementation actions" on public.implementation_actions
for update to authenticated using (
  public.is_access_admin()
  or (department_code is not null and public.can_manage_department(department_code))
) with check (
  public.is_access_admin()
  or (department_code is not null and public.can_manage_department(department_code))
);

grant select,update on public.implementation_actions to authenticated;

insert into public.implementation_actions
  (id,title,detail,department_code,owner_label,phase,start_date,due_date,status,priority,success_measure)
values
  ('AP-01','สร้างบัญชีจริงและทดสอบสิทธิ์ Profile/RLS','เริ่มเปิดใช้สำหรับ Admin และหัวหน้าแผนก ตรวจว่าเห็นและแก้ไขได้เฉพาะขอบเขตที่ได้รับ','PROG','Admin / Programmer','go_live','2026-09-01','2026-09-07','in_progress','critical','Admin และ Lead ทุกแผนกผ่าน UAT โดยไม่มีการรั่วไหลข้ามแผนก'),
  ('AP-02','บังคับใช้ Daily Activity ในแผนกที่ขาดข้อมูล','ติดตามแผนกที่ยังไม่ส่งหรือมีปริมาณต่ำ และลดรายการที่ต้องตรวจเวลา','KPI','KPI / หัวหน้าแผนก','adoption','2026-09-01','2026-09-14','in_progress','high','ทุกแผนกมีข้อมูลรายวัน และยอดตรวจเวลาลดลงต่อเนื่อง'),
  ('AP-03','ย้ายรายงาน Graphic Production ภายใต้ Marketing','รวมตัวเลข Graphic ในรายงาน Marketing และมอบหมายงานกราฟิกที่ยังไม่มีผู้รับผิดชอบ','MKT','Marketing / Graphic Lead','structure','2026-09-01','2026-09-07','in_progress','critical','Marketing report รวม Graphic และงานค้างทุกงานมีผู้รับผิดชอบ'),
  ('AP-04','จัดตั้ง 3X Focus Team และสร้าง SOP','วิเคราะห์ปัญหา Payment/3X ที่เกิดซ้ำ ยืนยันวิธีแก้ และจัดทำคู่มือป้องกันการเกิดซ้ำ','ADMIN','3X Focus Team','improvement','2026-09-01','2026-09-30','not_started','critical','เคส 3X ค้างลดลง และวิธีแก้ที่ยืนยันแล้วถูกยกเป็น SOP'),
  ('UAT-01','สร้างบัญชี Admin/Lead ทุกแผนก','ยืนยันอีเมล ตำแหน่ง แผนกหลัก และสถานะบัญชี','PROG','Admin','uat_week_1','2026-09-01','2026-09-01','in_progress','critical','บัญชีครบและเข้าระบบได้'),
  ('UAT-02','ทดสอบ RLS ตาม Profile','ทดสอบ Staff, Lead, Executive และ Admin ด้วยบัญชีจริง','PROG','Programmer / UAT','uat_week_1','2026-09-02','2026-09-02','not_started','critical','ไม่เห็นหรือแก้ไขข้อมูลข้ามสิทธิ์'),
  ('UAT-03','ทดสอบโครงสร้าง Marketing + Graphic','ตรวจยอดรวม ตัวกรอง และงานกราฟิกที่ยังไม่มีผู้รับผิดชอบ','MKT','Marketing / Graphic Lead','uat_week_1','2026-09-03','2026-09-03','not_started','high','ยอดรวมตรงกับรายการจริง'),
  ('UAT-04','ตรวจ Daily Activity แผนกที่ขาด','ตรวจความพร้อมรายแผนก และมอบหมายผู้แก้ไข','KPI','KPI / หัวหน้าแผนก','uat_week_1','2026-09-04','2026-09-04','not_started','high','ทุกแผนกมีผู้รับผิดชอบข้อมูล'),
  ('UAT-05','ทดสอบ Issue ถึง SOP ครบวงจร','แจ้งปัญหา ระบุสาเหตุ บันทึกวิธีแก้ ยืนยัน และสร้าง SOP','ADMIN','Admin Lead / 3X','uat_week_1','2026-09-05','2026-09-05','not_started','critical','สร้าง SOP draft จากเคสที่ยืนยันแล้วได้'),
  ('UAT-06','กระทบยอดรายงานผู้บริหาร','เทียบยอด Dashboard, Graphic, Daily Activity, Issue และ Action Plan','KPI','KPI / Executive','uat_week_1','2026-09-06','2026-09-06','not_started','critical','ยอดบนรายงานตรงกับตารางต้นทาง'),
  ('UAT-07','ประเมินผ่านระยะที่ 1','สรุปผล UAT จุดค้าง เกณฑ์หยุด และมติขยายสิทธิ์ Staff',null,'Executive / Admin','uat_week_1','2026-09-07','2026-09-07','not_started','critical','มีมติ Go/No-Go และหลักฐานครบ')
on conflict(id) do update set
  title=excluded.title,detail=excluded.detail,department_code=excluded.department_code,
  owner_label=excluded.owner_label,phase=excluded.phase,start_date=excluded.start_date,
  due_date=excluded.due_date,priority=excluded.priority,success_measure=excluded.success_measure;

comment on table public.implementation_actions is
  'Production action plan and UAT register derived from the Company Hub meeting report.';
comment on column public.departments.reporting_parent_code is
  'Management reporting parent only; does not change department RLS or source-data ownership.';
