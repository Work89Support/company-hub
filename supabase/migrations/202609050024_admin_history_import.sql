-- Preserve required native entry while allowing database-owner historical imports.
begin;
create or replace function public.enforce_issue_entry_requirements()
returns trigger language plpgsql set search_path=public as $$
begin
 -- Dashboard-only historical import: no anonymous or authenticated app caller.
 -- Missing source fields remain visible in the completeness queue.
 if current_user='postgres' and auth.uid() is null and
    new.source='Google Sheets · Problem Management V2' and
    new.source_document_id='1PWEXVMg-bg-xOBNfAvvrjPl5K6F4Eqvp2B894-1dTI4' and
    new.source_sheet='Issues' and new.source_row>1 then return new;end if;
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
commit;
