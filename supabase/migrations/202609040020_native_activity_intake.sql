-- Native activity entry. Imported history stays intact until a manager assigns
-- its real owner; never infer an account from a display name.
begin;
alter table public.daily_activities
  add column if not exists employee_id uuid references public.profiles(id),
  add column if not exists entry_revision integer not null default 0;
create or replace function public.bump_activity_entry_revision()
returns trigger language plpgsql set search_path=public as $$
begin new.entry_revision:=old.entry_revision+1; return new; end $$;
create trigger daily_activities_entry_revision before update on public.daily_activities
for each row execute function public.bump_activity_entry_revision();
create index if not exists daily_activities_owner_idx on public.daily_activities(employee_id,activity_date desc);

create table if not exists public.activity_edit_history (
 id bigint generated always as identity primary key,
 activity_id bigint not null references public.daily_activities(id),
 actor_id uuid not null references public.profiles(id),
 before_record jsonb,
 after_record jsonb not null,
 created_at timestamptz not null default now()
);
alter table public.activity_edit_history enable row level security;
create policy "managers read activity changes" on public.activity_edit_history for select to authenticated
using (exists(select 1 from public.daily_activities d where d.id=activity_id and public.can_manage_department(d.department_code)));
grant select on public.activity_edit_history to authenticated;

-- Existing department visibility remains available to leads; staff records
-- are personal, including when their profile can view another department.
drop policy if exists "read visible daily activities" on public.daily_activities;
create policy "read visible daily activities" on public.daily_activities for select to authenticated using (
 is_active and exists(select 1 from public.profiles p where p.id=auth.uid() and p.active and
 (employee_id=p.id or p.role in ('exec','admin') or (p.role='lead' and public.can_view_department(daily_activities.department_code))))
);
-- Every write must use the validated RPC. Previous verification RPC stays
-- available to managers, but does not grant ownership or edit other fields.
revoke insert,update,delete on public.daily_activities from authenticated;
revoke execute on function public.import_daily_activities(jsonb) from authenticated;
revoke execute on function public.finalize_daily_activity_sync(jsonb,text,jsonb) from authenticated;

create or replace function public.activity_entry_people()
returns table(id uuid,display_name text,department_code text)
language sql stable security definer set search_path=public as $$
 select p.id,coalesce(nullif(trim(p.display_name),''),p.email),p.department_code
 from public.profiles p where p.active and exists(select 1 from public.profiles c where c.id=auth.uid() and c.active)
 and (p.id=auth.uid() or public.can_manage_department(p.department_code))
 order by p.display_name
$$;
revoke all on function public.activity_entry_people() from public;
grant execute on function public.activity_entry_people() to authenticated;

create or replace function public.save_activity_entry(p_id bigint,p_expected_revision integer,p_entry jsonb)
returns public.daily_activities language plpgsql security definer set search_path=public as $$
declare
 caller public.profiles%rowtype; owner_profile public.profiles%rowtype;
 previous public.daily_activities%rowtype; saved public.daily_activities%rowtype;
 dept text; owner_id uuid; day date; done_day date; st time; en time; mins integer;
 state text; task text; cat text; result_text text; overnight boolean; request_key text;
begin
 select * into caller from public.profiles where id=auth.uid() and active;
 if caller.id is null then raise exception 'กรุณาเข้าสู่ระบบด้วยบัญชีที่ใช้งานได้'; end if;
 if jsonb_typeof(p_entry) is distinct from 'object' then raise exception 'ข้อมูลบันทึกไม่ถูกต้อง'; end if;
 if p_id is not null then
  select * into previous from public.daily_activities where id=p_id and is_active for update;
  if previous.id is null or not (coalesce(previous.employee_id=caller.id,false) or public.can_manage_department(previous.department_code)) then
   raise exception 'ไม่มีสิทธิ์แก้ไขรายการนี้'; end if;
  if p_expected_revision is distinct from previous.entry_revision then raise exception 'ข้อมูลถูกแก้ไขแล้ว กรุณาโหลดใหม่ก่อนบันทึก'; end if;
 end if;
 dept:=trim(p_entry->>'department_code'); owner_id:=nullif(p_entry->>'employee_id','')::uuid;
 if dept is null or owner_id is null then raise exception 'กรุณาระบุแผนกและบัญชีเจ้าของรายการ'; end if;
 if p_id is not null and dept is distinct from previous.department_code then raise exception 'ไม่สามารถย้ายแผนกของรายการเดิม'; end if;
 if not public.can_manage_department(dept) then
  if owner_id<>caller.id or dept<>caller.department_code or (p_id is not null and previous.employee_id is distinct from caller.id) then
   raise exception 'บันทึกได้เฉพาะรายการของตนเองในแผนกหลัก'; end if;
 end if;
 select * into owner_profile from public.profiles where id=owner_id and active and department_code=dept;
 if owner_profile.id is null then raise exception 'เจ้าของรายการต้องเป็นบัญชีที่ใช้งานในแผนกนี้'; end if;
 task:=trim(coalesce(p_entry->>'activity',''));cat:=trim(coalesce(p_entry->>'category',''));
 state:=coalesce(p_entry->>'status','');result_text:=trim(coalesce(p_entry->>'result_note',''));
 day:=nullif(p_entry->>'activity_date','')::date; done_day:=nullif(p_entry->>'completed_date','')::date;
 st:=public.parse_activity_time(p_entry->>'start_time'); en:=public.parse_activity_time(p_entry->>'end_time');
 overnight:=coalesce((p_entry->>'overnight')::boolean,false);
 if task='' or cat='' or day is null or st is null or state not in ('In Progress','Completed','Blocked') then
  raise exception 'กรุณากรอกวันที่ กิจกรรม ประเภท เวลาเริ่ม และสถานะให้ครบ'; end if;
 if length(task)>4000 or length(cat)>200 or length(result_text)>4000 or length(coalesce(p_entry->>'worksite',''))>500 or length(coalesce(p_entry->>'operational_issue',''))>4000 then
  raise exception 'ข้อความยาวเกินกำหนด'; end if;
 if day>(now() at time zone 'Asia/Bangkok')::date then raise exception 'วันที่ทำงานต้องไม่เป็นอนาคต'; end if;
 if state='Completed' and (en is null or result_text='' or done_day is null) then raise exception 'งานเสร็จต้องมีเวลาจบ วันที่เสร็จ และผลลัพธ์'; end if;
 if state='Blocked' and trim(coalesce(p_entry->>'operational_issue',''))='' then raise exception 'กรุณาระบุปัญหาที่ทำให้งานติดขัด'; end if;
 if done_day is not null and (done_day<day or (overnight and done_day=day) or done_day>(now() at time zone 'Asia/Bangkok')::date) then raise exception 'วันที่เสร็จไม่ถูกต้อง'; end if;
 if coalesce(p_entry->>'end_time','')<>'' and en is null then raise exception 'เวลาจบไม่ถูกต้อง'; end if;
 if en is not null then
  mins:=round(extract(epoch from (en-st))/60)::integer;
  if overnight then mins:=mins+1440; end if;
  if mins<=0 or mins>960 then raise exception 'เวลาทำงานต้องมากกว่า 0 และไม่เกิน 16 ชั่วโมง ตรวจเวลาหรือช่องข้ามวัน'; end if;
 end if;
 if p_id is null then
  -- Client-generated UUID survives retries and cannot overwrite another user.
  request_key:='native-'||(p_entry->>'request_id')::uuid::text;
  if request_key is null then raise exception 'ไม่มีรหัสคำขอ กรุณาเปิดฟอร์มใหม่'; end if;
  select * into saved from public.daily_activities where source_key=request_key;
  if saved.id is not null then
   if saved.created_by is distinct from caller.id then raise exception 'รหัสคำขอถูกใช้แล้ว'; end if;
   return saved;
  end if;
  insert into public.daily_activities(source_key,department_code,department_label,employee_id,employee_name,activity_date,activity,category,start_time,end_time,duration_minutes,status,time_flag,result_note,completed_date,worksite,operational_issue,source,created_by,entry_revision)
  values(request_key,dept,(select name from public.departments where code=dept),owner_id,coalesce(nullif(trim(owner_profile.display_name),''),owner_profile.email),day,task,cat,st,en,mins,state,case when en is null then 'missing' else 'ok' end,result_text,done_day,trim(coalesce(p_entry->>'worksite','')),trim(coalesce(p_entry->>'operational_issue','')),'Company Hub',caller.id,1) returning * into saved;
 else
  update public.daily_activities set employee_id=owner_id,employee_name=coalesce(nullif(trim(owner_profile.display_name),''),owner_profile.email),activity_date=day,activity=task,category=cat,start_time=st,end_time=en,duration_minutes=mins,status=state,time_flag=case when en is null then 'missing' else 'ok' end,result_note=result_text,completed_date=done_day,worksite=trim(coalesce(p_entry->>'worksite','')),operational_issue=trim(coalesce(p_entry->>'operational_issue','')),source='Company Hub',data_quality_flags='{}',entry_revision=entry_revision+1,verified_by=null,verified_at=null,verification_note=null
  where id=p_id returning * into saved;
 end if;
 insert into public.activity_edit_history(activity_id,actor_id,before_record,after_record)
 values(saved.id,caller.id,case when previous.id is null then null else to_jsonb(previous) end,to_jsonb(saved));
 return saved;
end $$;
revoke all on function public.save_activity_entry(bigint,integer,jsonb) from public;
grant execute on function public.save_activity_entry(bigint,integer,jsonb) to authenticated;
-- Managers can route incomplete history to its owner without inventing the
-- missing work details. The employee completes those details in their queue.
create or replace function public.assign_activity_owner(p_id bigint,p_expected_revision integer,p_owner uuid)
returns public.daily_activities language plpgsql security definer set search_path=public as $$
declare prior public.daily_activities%rowtype; saved public.daily_activities%rowtype; person public.profiles%rowtype;
begin
 select * into prior from public.daily_activities where id=p_id and is_active for update;
 if prior.id is null or not public.can_manage_department(prior.department_code) then raise exception 'เฉพาะหัวหน้าที่จัดการแผนกนี้จึงมอบหมายได้'; end if;
 if prior.entry_revision is distinct from p_expected_revision then raise exception 'ข้อมูลเปลี่ยนแล้ว กรุณาโหลดใหม่'; end if;
 select * into person from public.profiles where id=p_owner and active and department_code=prior.department_code;
 if person.id is null then raise exception 'กรุณาเลือกบัญชีที่ใช้งานในแผนกนี้'; end if;
 update public.daily_activities set employee_id=person.id,employee_name=coalesce(nullif(trim(person.display_name),''),person.email),source='Company Hub' where id=p_id returning * into saved;
 insert into public.activity_edit_history(activity_id,actor_id,before_record,after_record) values(p_id,auth.uid(),to_jsonb(prior),to_jsonb(saved));
 return saved;
end $$;
revoke all on function public.assign_activity_owner(bigint,integer,uuid) from public;
grant execute on function public.assign_activity_owner(bigint,integer,uuid) to authenticated;
commit;
