-- Require actionable intake, allow reporters to complete their own details,
-- and preserve manager-only closure. No imported record is deleted.
begin;
create or replace function public.enforce_issue_entry_requirements()
returns trigger language plpgsql set search_path=public as $$
begin
 if tg_op='INSERT' then
  if auth.uid() is not null then select coalesce(nullif(trim(display_name),''),email) into new.reporter from public.profiles where id=auth.uid() and active; end if;
  if trim(new.problem)='' or trim(new.project_code)='' or trim(new.category)='' or trim(new.reporter)='' or trim(new.owner_team)='' or trim(new.impact_summary)='' or new.impact_scope='unknown' then
   raise exception 'กรุณาระบุเหตุการณ์ โปรเจกต์ ประเภท ผู้แจ้ง ทีมรับผิดชอบ และผลกระทบให้ครบ'; end if;
  if new.status<>'Open' then raise exception 'เคสใหม่ต้องเริ่มที่สถานะยังไม่แก้'; end if;
 else
  if new.created_by is distinct from old.created_by or new.department_code is distinct from old.department_code then raise exception 'ไม่สามารถเปลี่ยนผู้แจ้งหรือแผนกของเคสเดิม'; end if;
  if new.status='Resolved' and (old.status is distinct from new.status or old.solution is distinct from new.solution or old.solution_verified is distinct from new.solution_verified or old.owner_team is distinct from new.owner_team or old.resolution_minutes is distinct from new.resolution_minutes or old.solution_type is distinct from new.solution_type) then
   if trim(new.impact_summary)='' or new.impact_scope='unknown' or trim(new.owner_team)='' or trim(new.solution)='' or new.resolution_minutes is null or not new.solution_verified or new.solution_type in ('','unresolved') then
    raise exception 'ปิดเคสต้องมีทีมรับผิดชอบ วิธีแก้ ประเภทวิธีแก้ ระยะเวลา และการยืนยันผล'; end if;
   if not public.can_manage_department(new.department_code) then raise exception 'หัวหน้าที่มีสิทธิ์ต้องยืนยันการปิดเคส'; end if;
   new.solution_verified_by:=auth.uid();new.solution_verified_at:=now();
  end if;
 end if;
 if new.evidence_url<>'' and new.evidence_url !~* '^https?://' then raise exception 'ลิงก์หลักฐานต้องขึ้นต้นด้วย http:// หรือ https://'; end if;
 return new;
end $$;
create trigger issue_required_entry before insert or update on public.operational_issues
for each row execute function public.enforce_issue_entry_requirements();
-- Prevent caller-supplied import metadata or creator/status spoofing at intake.
drop policy if exists "report visible operational issues" on public.operational_issues;
create policy "report visible operational issues" on public.operational_issues for insert to authenticated with check (
 created_by=auth.uid() and department_code='ADMIN' and source='Company Hub' and status='Open'
 and not solution_verified and solution_verified_by is null
 and exists(select 1 from public.profiles p where p.id=auth.uid() and p.active)
);

create or replace function public.save_issue_intake_details(p_id text,p_expected_updated_at timestamptz,p_details jsonb)
returns public.operational_issues language plpgsql security definer set search_path=public as $$
declare original public.operational_issues%rowtype; saved public.operational_issues%rowtype;
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and active) then raise exception 'กรุณาเข้าสู่ระบบ'; end if;
 select * into original from public.operational_issues where id=p_id for update;
 if original.id is null or not (coalesce(original.created_by=auth.uid(),false) or public.can_manage_department(original.department_code)) then raise exception 'ไม่มีสิทธิ์แก้รายละเอียดเคสนี้'; end if;
 if original.updated_at is distinct from p_expected_updated_at then raise exception 'ข้อมูลถูกแก้ไขแล้ว กรุณาโหลดใหม่'; end if;
 if trim(coalesce(p_details->>'problem',''))='' or trim(coalesce(p_details->>'impact_summary',''))='' or coalesce(p_details->>'impact_scope','unknown') not in ('single_customer','multiple_customers','project','multiple_projects','companywide') then
  raise exception 'กรุณาระบุรายละเอียดปัญหา ขอบเขต และสรุปผลกระทบ'; end if;
 if length(p_details->>'problem')>4000 then raise exception 'รายละเอียดปัญหายาวเกินกำหนด'; end if;
 update public.operational_issues set problem=trim(p_details->>'problem'),impact_scope=p_details->>'impact_scope',impact_summary=trim(p_details->>'impact_summary'),service_name=trim(coalesce(p_details->>'service_name','')),provider_name=trim(coalesce(p_details->>'provider_name','')),workaround=trim(coalesce(p_details->>'workaround','')),evidence_url=trim(coalesce(p_details->>'evidence_url','')) where id=p_id returning * into saved;
 return saved;
end $$;
revoke all on function public.save_issue_intake_details(text,timestamptz,jsonb) from public;
grant execute on function public.save_issue_intake_details(text,timestamptz,jsonb) to authenticated;
commit;
