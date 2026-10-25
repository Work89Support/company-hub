-- Personal workspaces created when each assignee acknowledges a task.
begin;

create table if not exists public.task_assignee_workspaces (
  task_id uuid not null,
  user_id uuid not null,
  status text not null default 'todo' check (status in ('todo','doing','review','block')),
  progress_percent integer not null default 0 check (progress_percent between 0 and 100),
  update_note text not null default '' check (char_length(update_note)<=5000),
  acknowledged_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(task_id,user_id),
  foreign key(task_id,user_id) references public.task_assignees(task_id,user_id) on delete cascade
);

create table if not exists public.task_assignee_files (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null,
  user_id uuid not null,
  file_name text not null check (char_length(trim(file_name)) between 1 and 255),
  storage_path text not null unique,
  mime_type text,
  size_bytes bigint not null check (size_bytes between 1 and 10485760),
  created_at timestamptz not null default now(),
  foreign key(task_id,user_id) references public.task_assignee_workspaces(task_id,user_id) on delete cascade
);

create index if not exists task_assignee_workspaces_user_idx on public.task_assignee_workspaces(user_id,updated_at desc);
create index if not exists task_assignee_files_workspace_idx on public.task_assignee_files(task_id,user_id,created_at desc);

create or replace function public.can_view_assignee_workspace(p_task uuid,p_user uuid)
returns boolean language sql stable security definer set search_path=public
as $$
  select auth.uid()=p_user
    or public.can_manage_task(p_task)
    or exists(select 1 from public.tasks t where t.id=p_task and t.creator_id=auth.uid())
$$;

create or replace function public.acknowledge_my_task(p_task uuid)
returns timestamptz language plpgsql security definer set search_path=public
as $$
declare result timestamptz; did_ack boolean:=false;
begin
  if auth.uid() is null then raise exception using errcode='42501',message='authentication required'; end if;
  if not exists(select 1 from public.profiles where id=auth.uid() and active) then
    raise exception using errcode='42501',message='active profile required';
  end if;
  update public.task_assignees set acknowledged_at=clock_timestamp()
   where task_id=p_task and user_id=auth.uid() and acknowledged_at is null
   returning acknowledged_at into result;
  if result is null then
    select acknowledged_at into result from public.task_assignees where task_id=p_task and user_id=auth.uid();
  else did_ack:=true;
  end if;
  if result is null then raise exception using errcode='42501',message='task assignment required'; end if;

  insert into public.task_assignee_workspaces(task_id,user_id,acknowledged_at)
  values(p_task,auth.uid(),result) on conflict(task_id,user_id) do nothing;
  if did_ack then
    insert into public.task_events(task_id,actor_id,event_type,payload)
    values(p_task,auth.uid(),'assignment_acknowledged',jsonb_build_object('acknowledged_at',result));
  end if;
  return result;
end
$$;

create or replace function public.update_my_task_workspace(p_task uuid,p_status text,p_progress integer,p_note text)
returns public.task_assignee_workspaces
language plpgsql security definer set search_path=public
as $$
declare result public.task_assignee_workspaces;
begin
  if p_status not in ('todo','doing','review','block') then raise exception 'invalid status'; end if;
  if p_progress not between 0 and 100 then raise exception 'invalid progress'; end if;
  update public.task_assignee_workspaces
     set status=p_status,progress_percent=p_progress,update_note=left(trim(coalesce(p_note,'')),5000),updated_at=clock_timestamp()
   where task_id=p_task and user_id=auth.uid()
   returning * into result;
  if result.task_id is null then raise exception using errcode='42501',message='acknowledged assignment required'; end if;
  insert into public.task_events(task_id,actor_id,event_type,payload)
  values(p_task,auth.uid(),'assignee_workspace_updated',jsonb_build_object('status',p_status,'progress_percent',p_progress));
  return result;
end
$$;

create or replace function public.set_my_task_file(p_task uuid,p_path text,p_name text,p_mime text,p_size bigint)
returns uuid language plpgsql security definer set search_path=public
as $$
declare result uuid;
begin
  if not exists(select 1 from public.task_assignee_workspaces where task_id=p_task and user_id=auth.uid()) then
    raise exception using errcode='42501',message='acknowledged assignment required';
  end if;
  if split_part(p_path,'/',1)<>p_task::text or split_part(p_path,'/',2)<>auth.uid()::text then raise exception 'invalid file path'; end if;
  insert into public.task_assignee_files(task_id,user_id,file_name,storage_path,mime_type,size_bytes)
  values(p_task,auth.uid(),left(trim(p_name),255),p_path,nullif(left(trim(coalesce(p_mime,'')),150),''),p_size)
  returning id into result;
  return result;
end
$$;

create or replace function public.delete_my_task_file(p_file uuid)
returns text language plpgsql security definer set search_path=public
as $$
declare result text;
begin
  delete from public.task_assignee_files where id=p_file and user_id=auth.uid() returning storage_path into result;
  if result is null then raise exception using errcode='42501',message='file owner required'; end if;
  return result;
end
$$;

alter table public.task_assignee_workspaces enable row level security;
alter table public.task_assignee_files enable row level security;
create policy "workspace participants read" on public.task_assignee_workspaces for select to authenticated
using (public.can_view_assignee_workspace(task_id,user_id));
create policy "workspace participants read files" on public.task_assignee_files for select to authenticated
using (public.can_view_assignee_workspace(task_id,user_id));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('task-assignee-files','task-assignee-files',false,10485760,
array['image/jpeg','image/png','image/webp','image/gif','application/pdf','text/plain','text/csv','application/zip','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.openxmlformats-officedocument.presentationml.presentation'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create or replace function public.task_from_storage_path(p_name text)
returns uuid language plpgsql immutable set search_path=public
as $$ begin return split_part(p_name,'/',1)::uuid; exception when others then return null; end $$;

create policy "workspace participants read uploads" on storage.objects for select to authenticated
using (bucket_id='task-assignee-files' and public.can_view_assignee_workspace(public.task_from_storage_path(name),split_part(name,'/',2)::uuid));
create policy "assignees upload workspace files" on storage.objects for insert to authenticated
with check (bucket_id='task-assignee-files' and split_part(name,'/',2)=auth.uid()::text and public.is_task_assignee(public.task_from_storage_path(name)));
create policy "assignees delete workspace files" on storage.objects for delete to authenticated
using (bucket_id='task-assignee-files' and split_part(name,'/',2)=auth.uid()::text);

revoke all on function public.can_view_assignee_workspace(uuid,uuid),public.update_my_task_workspace(uuid,text,integer,text),public.set_my_task_file(uuid,text,text,text,bigint),public.delete_my_task_file(uuid) from public;
grant execute on function public.can_view_assignee_workspace(uuid,uuid),public.update_my_task_workspace(uuid,text,integer,text),public.set_my_task_file(uuid,text,text,text,bigint),public.delete_my_task_file(uuid) to authenticated;
grant select on public.task_assignee_workspaces,public.task_assignee_files to authenticated;

commit;
