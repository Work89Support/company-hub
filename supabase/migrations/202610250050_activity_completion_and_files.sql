-- Historical completed activities use their submitted work date as the
-- completion date. Activity evidence can be uploaded inside the activity.
begin;

create or replace function public.default_historical_activity_completion_date()
returns trigger language plpgsql set search_path=public as $$
begin
  if new.completed_date is null
     and new.activity_date is not null
     and new.status ~* '(completed|เสร็จ)'
     and lower(coalesce(new.source,'')) <> 'company hub' then
    new.completed_date:=new.activity_date;
  end if;
  return new;
end
$$;

drop trigger if exists daily_activities_default_historical_completion on public.daily_activities;
create trigger daily_activities_default_historical_completion
before insert or update of status,completed_date,activity_date,source
on public.daily_activities for each row
execute function public.default_historical_activity_completion_date();

update public.daily_activities
set completed_date=activity_date
where is_active
  and completed_date is null
  and status ~* '(completed|เสร็จ)';

create table if not exists public.activity_files (
  id uuid primary key default gen_random_uuid(),
  activity_id bigint not null references public.daily_activities(id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id),
  file_name text not null check (char_length(trim(file_name)) between 1 and 255),
  storage_path text not null unique,
  mime_type text,
  size_bytes bigint not null check (size_bytes between 1 and 10485760),
  created_at timestamptz not null default now()
);

create index if not exists activity_files_activity_idx
on public.activity_files(activity_id,created_at desc);

create or replace function public.can_contribute_daily_activity(target_activity_id bigint)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(
    select 1
    from public.daily_activities d
    join public.profiles p on p.id=auth.uid() and p.active
    where d.id=target_activity_id and d.is_active and (
      d.employee_id=p.id
      or d.created_by=p.id
      or public.can_manage_department(d.department_code)
      or exists(
        select 1 from public.activity_assignees a
        where a.activity_id=d.id and (
          a.profile_id=p.id
          or (a.assignment_type='department' and (
            p.department_code=a.department_code
            or exists(select 1 from public.profile_departments pd where pd.profile_id=p.id and pd.department_code=a.department_code)
          ))
        )
      )
    )
  )
$$;

create or replace function public.activity_from_storage_path(p_name text)
returns bigint language plpgsql immutable set search_path=public as $$
begin return split_part(p_name,'/',1)::bigint;
exception when others then return null;
end
$$;

create or replace function public.add_activity_file(
  p_activity bigint,p_path text,p_name text,p_mime text,p_size bigint
)
returns uuid language plpgsql security definer set search_path=public as $$
declare result uuid;
begin
  if not public.can_contribute_daily_activity(p_activity) then
    raise exception using errcode='42501',message='ไม่มีสิทธิ์แนบไฟล์ในงานนี้';
  end if;
  if split_part(p_path,'/',1)<>p_activity::text or split_part(p_path,'/',2)<>auth.uid()::text then
    raise exception 'invalid file path';
  end if;
  insert into public.activity_files(activity_id,uploaded_by,file_name,storage_path,mime_type,size_bytes)
  values(p_activity,auth.uid(),left(trim(p_name),255),p_path,nullif(left(trim(coalesce(p_mime,'')),150),''),p_size)
  returning id into result;
  return result;
end
$$;

create or replace function public.delete_my_activity_file(p_file uuid)
returns text language plpgsql security definer set search_path=public as $$
declare result text;
begin
  delete from public.activity_files
  where id=p_file and uploaded_by=auth.uid()
  returning storage_path into result;
  if result is null then raise exception using errcode='42501',message='ลบได้เฉพาะไฟล์ที่คุณแนบ'; end if;
  return result;
end
$$;

alter table public.activity_files enable row level security;
drop policy if exists "activity participants read files" on public.activity_files;
create policy "activity participants read files" on public.activity_files
for select to authenticated using (public.can_read_daily_activity(activity_id));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('activity-files','activity-files',false,10485760,
array['image/jpeg','image/png','image/webp','image/gif','application/pdf','text/plain','text/csv','application/zip','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.openxmlformats-officedocument.presentationml.presentation'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "activity participants read uploads" on storage.objects;
drop policy if exists "activity participants upload files" on storage.objects;
drop policy if exists "activity uploaders delete files" on storage.objects;
create policy "activity participants read uploads" on storage.objects for select to authenticated
using (bucket_id='activity-files' and public.can_read_daily_activity(public.activity_from_storage_path(name)));
create policy "activity participants upload files" on storage.objects for insert to authenticated
with check (
  bucket_id='activity-files'
  and split_part(name,'/',2)=auth.uid()::text
  and public.can_contribute_daily_activity(public.activity_from_storage_path(name))
);
create policy "activity uploaders delete files" on storage.objects for delete to authenticated
using (bucket_id='activity-files' and split_part(name,'/',2)=auth.uid()::text);

grant select on public.activity_files to authenticated;
revoke insert,update,delete on public.activity_files from authenticated;
revoke all on function public.add_activity_file(bigint,text,text,text,bigint) from public;
revoke all on function public.delete_my_activity_file(uuid) from public;
grant execute on function public.add_activity_file(bigint,text,text,text,bigint) to authenticated;
grant execute on function public.delete_my_activity_file(uuid) to authenticated;
grant execute on function public.can_contribute_daily_activity(bigint) to authenticated;

comment on table public.activity_files is
  'Private evidence attachments uploaded directly inside daily activity records.';

commit;
