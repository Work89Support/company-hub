-- Native Company Hub activities may be removed by their creator, owner, or a
-- manager of the activity department. Imported history remains immutable.
begin;

create or replace function public.delete_activity_entry(
  p_id bigint,
  p_expected_revision integer
)
returns bigint language plpgsql security definer set search_path=public as $$
declare
  caller public.profiles%rowtype;
  previous public.daily_activities%rowtype;
  saved public.daily_activities%rowtype;
begin
  select * into caller from public.profiles where id=auth.uid() and active;
  if caller.id is null then raise exception 'กรุณาเข้าสู่ระบบด้วยบัญชีที่ใช้งานได้'; end if;

  select * into previous from public.daily_activities where id=p_id and is_active for update;
  if previous.id is null then raise exception 'ไม่พบกิจกรรม หรือรายการถูกลบแล้ว'; end if;
  if previous.source_key is null or previous.source_key not like 'native-%' then
    raise exception 'ลบได้เฉพาะกิจกรรมที่บันทึกผ่าน Company Hub';
  end if;
  if not (
    previous.created_by=caller.id
    or previous.employee_id=caller.id
    or public.can_manage_department(previous.department_code)
  ) then
    raise exception 'ลบได้เฉพาะผู้สร้าง เจ้าของงาน หรือหัวหน้าที่ดูแลแผนก';
  end if;
  if p_expected_revision is distinct from previous.entry_revision then
    raise exception 'ข้อมูลถูกแก้ไขแล้ว กรุณาโหลดใหม่ก่อนลบ';
  end if;

  update public.daily_activities
  set is_active=false,sync_status='stale'
  where id=previous.id
  returning * into saved;

  insert into public.activity_edit_history(activity_id,actor_id,before_record,after_record)
  values(previous.id,caller.id,to_jsonb(previous),to_jsonb(saved));
  return previous.id;
end
$$;

revoke all on function public.delete_activity_entry(bigint,integer) from public;
grant execute on function public.delete_activity_entry(bigint,integer) to authenticated;

commit;
