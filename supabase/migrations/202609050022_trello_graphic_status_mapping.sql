-- Keep Trello list names aligned with Company Hub Graphic Production statuses.

create or replace function public.graphic_status_from_trello(list_name text)
returns text language sql immutable as $$
  select case
    when lower(coalesce(list_name,'')) ~ 'done|เสร็จ|ดำเนินการแล้ว' then 'done'
    when lower(coalesce(list_name,'')) ~ 'monthly|รายเดือน|ประจำเดือน' then 'monthly'
    when lower(coalesce(list_name,'')) ~ 'revision|แก้ไข|แก้งาน' then 'revision'
    when lower(coalesce(list_name,'')) ~ 'review|ตรวจ|ส่งงาน' then 'review'
    when lower(coalesce(list_name,'')) ~ 'doing|in progress|กำลังทำ|กำลังดำเนินการ' then 'doing'
    when lower(coalesce(list_name,'')) ~ 'marketing|การตลาด' then 'brief'
    else 'intake'
  end
$$;

update public.graphic_jobs
set status=public.graphic_status_from_trello(source_payload->>'trello_list_name')
where source='Trello'
  and coalesce(source_payload->>'trello_list_name','')<>'';

comment on function public.graphic_status_from_trello(text) is
  'Maps current and legacy Trello Graphic list names to Company Hub workflow statuses.';
