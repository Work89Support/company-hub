-- Rich Trello synchronization for Graphic Production.
-- Adds covers, previews, members, comments, complete card activity and account linking.

alter table public.graphic_jobs
  add column if not exists cover_url text not null default '',
  add column if not exists cover_color text not null default '',
  add column if not exists trello_position numeric,
  add column if not exists trello_last_activity_at timestamptz,
  add column if not exists due_complete boolean not null default false;

alter table public.graphic_job_files
  add column if not exists preview_url text not null default '',
  add column if not exists mime_type text not null default '',
  add column if not exists size_bytes bigint;

alter table public.graphic_job_events
  add column if not exists source_id text;

create unique index if not exists graphic_job_events_source_id_uidx
  on public.graphic_job_events(source_id) where source_id is not null;

create table if not exists public.graphic_trello_members (
  trello_member_id text primary key,
  username text not null default '',
  full_name text not null default '',
  avatar_url text not null default '',
  email text,
  linked_profile_id uuid references public.profiles(id) on delete set null,
  account_status text not null default 'unlinked'
    check (account_status in ('unlinked','ready','invited','linked','disabled')),
  source_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.graphic_job_members (
  job_id uuid not null references public.graphic_jobs(id) on delete cascade,
  trello_member_id text not null references public.graphic_trello_members(trello_member_id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key(job_id,trello_member_id)
);

create table if not exists public.graphic_job_comments (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.graphic_jobs(id) on delete cascade,
  source_id text unique,
  source text not null default 'Company Hub',
  trello_member_id text references public.graphic_trello_members(trello_member_id) on delete set null,
  author_profile_id uuid references public.profiles(id) on delete set null,
  author_name text not null default '',
  author_avatar_url text not null default '',
  body text not null check (char_length(body) between 1 and 10000),
  source_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists graphic_job_members_job_idx on public.graphic_job_members(job_id);
create index if not exists graphic_job_comments_job_date_idx on public.graphic_job_comments(job_id,created_at desc);
create index if not exists graphic_trello_members_profile_idx on public.graphic_trello_members(linked_profile_id);

alter table public.graphic_trello_members enable row level security;
alter table public.graphic_job_members enable row level security;
alter table public.graphic_job_comments enable row level security;

drop policy if exists "read graphic trello members" on public.graphic_trello_members;
create policy "read graphic trello members" on public.graphic_trello_members for select to authenticated
using (public.can_view_department('GRAPHIC'));
drop policy if exists "manage graphic trello members" on public.graphic_trello_members;
create policy "manage graphic trello members" on public.graphic_trello_members for all to authenticated
using (public.can_manage_department('GRAPHIC')) with check (public.can_manage_department('GRAPHIC'));

drop policy if exists "read graphic job members" on public.graphic_job_members;
create policy "read graphic job members" on public.graphic_job_members for select to authenticated
using (exists(select 1 from public.graphic_jobs j where j.id=job_id and public.can_view_department(j.department_code)));
drop policy if exists "manage graphic job members" on public.graphic_job_members;
create policy "manage graphic job members" on public.graphic_job_members for all to authenticated
using (exists(select 1 from public.graphic_jobs j where j.id=job_id and public.can_manage_department(j.department_code)))
with check (exists(select 1 from public.graphic_jobs j where j.id=job_id and public.can_manage_department(j.department_code)));

drop policy if exists "read graphic comments" on public.graphic_job_comments;
create policy "read graphic comments" on public.graphic_job_comments for select to authenticated
using (exists(select 1 from public.graphic_jobs j where j.id=job_id and public.can_view_department(j.department_code)));
drop policy if exists "add graphic comments" on public.graphic_job_comments;
create policy "add graphic comments" on public.graphic_job_comments for insert to authenticated
with check (author_profile_id=auth.uid() and exists(select 1 from public.graphic_jobs j where j.id=job_id and public.can_view_department(j.department_code)));
drop policy if exists "manage own graphic comments" on public.graphic_job_comments;
create policy "manage own graphic comments" on public.graphic_job_comments for update to authenticated
using (author_profile_id=auth.uid() or exists(select 1 from public.graphic_jobs j where j.id=job_id and public.can_manage_department(j.department_code)))
with check (author_profile_id=auth.uid() or exists(select 1 from public.graphic_jobs j where j.id=job_id and public.can_manage_department(j.department_code)));

create or replace function public.import_trello_graphic_members(rows_payload jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare item jsonb; imported integer:=0;
begin
  if not public.can_manage_department('GRAPHIC') then raise exception 'GRAPHIC manager permission required'; end if;
  if jsonb_typeof(rows_payload)<>'array' then raise exception 'payload must be an array'; end if;
  for item in select value from jsonb_array_elements(rows_payload) loop
    if coalesce(item->>'trello_member_id','')='' then continue; end if;
    insert into public.graphic_trello_members(
      trello_member_id,username,full_name,avatar_url,email,account_status,source_payload
    ) values (
      left(item->>'trello_member_id',160),left(coalesce(item->>'username',''),160),
      left(coalesce(item->>'full_name',''),300),coalesce(item->>'avatar_url',''),
      nullif(lower(item->>'email'),''),case when coalesce(item->>'email','')<>'' then 'ready' else 'unlinked' end,
      coalesce(item->'source_payload','{}'::jsonb)
    ) on conflict(trello_member_id) do update set
      username=excluded.username,full_name=excluded.full_name,avatar_url=excluded.avatar_url,
      email=coalesce(graphic_trello_members.email,excluded.email),
      account_status=case when graphic_trello_members.linked_profile_id is not null then 'linked'
        when coalesce(graphic_trello_members.email,excluded.email) is not null then 'ready' else 'unlinked' end,
      source_payload=excluded.source_payload,updated_at=now();
    imported:=imported+1;
  end loop;
  return jsonb_build_object('members',imported);
end $$;

create or replace function public.import_trello_graphic_cards(rows_payload jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare item jsonb; attachment jsonb; member_id text; job_row uuid; member_row public.graphic_trello_members%rowtype;
  imported integer:=0; missing integer:=0; files_count integer:=0; member_count integer:=0;
begin
  if not public.can_manage_department('GRAPHIC') then raise exception 'GRAPHIC manager permission required'; end if;
  if jsonb_typeof(rows_payload)<>'array' then raise exception 'payload must be an array'; end if;
  for item in select value from jsonb_array_elements(rows_payload) loop
    select id into job_row from public.graphic_jobs where trello_card_id=item->>'trello_card_id';
    if job_row is null then missing:=missing+1; continue; end if;
    update public.graphic_jobs set
      cover_url=coalesce(item->>'cover_url',''),cover_color=coalesce(item->>'cover_color',''),
      trello_position=nullif(item->>'trello_position','')::numeric,
      trello_last_activity_at=nullif(item->>'trello_last_activity_at','')::timestamptz,
      due_complete=coalesce((item->>'due_complete')::boolean,false),
      source_payload=source_payload || coalesce(item->'card_patch','{}'::jsonb)
    where id=job_row;

    delete from public.graphic_job_members where job_id=job_row;
    for member_id in select value #>> '{}' from jsonb_array_elements(coalesce(item->'member_ids','[]'::jsonb)) loop
      insert into public.graphic_trello_members(trello_member_id,username,full_name)
      values(left(member_id,160),'','') on conflict(trello_member_id) do nothing;
      select * into member_row from public.graphic_trello_members where trello_member_id=member_id;
      insert into public.graphic_job_members(job_id,trello_member_id,profile_id)
      values(job_row,member_id,member_row.linked_profile_id) on conflict(job_id,trello_member_id) do update set profile_id=excluded.profile_id;
      member_count:=member_count+1;
    end loop;
    if jsonb_array_length(coalesce(item->'member_ids','[]'::jsonb))>0 then
      update public.graphic_jobs j set
        assignee_name=coalesce((select string_agg(nullif(m.full_name,''),', ' order by m.full_name) from public.graphic_job_members jm join public.graphic_trello_members m using(trello_member_id) where jm.job_id=j.id),j.assignee_name),
        assignee_id=coalesce((select min(m.linked_profile_id::text)::uuid from public.graphic_job_members jm join public.graphic_trello_members m using(trello_member_id) where jm.job_id=j.id),j.assignee_id)
      where j.id=job_row;
    end if;

    for attachment in select value from jsonb_array_elements(coalesce(item->'attachments','[]'::jsonb)) loop
      if coalesce(attachment->>'url','')='' then continue; end if;
      insert into public.graphic_job_files(job_id,name,url,file_type,source_id,created_by,preview_url,mime_type,size_bytes)
      values(job_row,left(coalesce(attachment->>'name','ไฟล์จาก Trello'),300),attachment->>'url','reference',
        left(attachment->>'source_id',160),auth.uid(),coalesce(attachment->>'preview_url',''),
        left(coalesce(attachment->>'mime_type',''),200),nullif(attachment->>'size_bytes','')::bigint)
      on conflict(job_id,source_id) do update set name=excluded.name,url=excluded.url,
        preview_url=excluded.preview_url,mime_type=excluded.mime_type,size_bytes=excluded.size_bytes;
      files_count:=files_count+1;
    end loop;
    imported:=imported+1;
  end loop;
  return jsonb_build_object('cards',imported,'missing_cards',missing,'files',files_count,'member_links',member_count);
end $$;

create or replace function public.import_trello_graphic_actions(rows_payload jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare item jsonb; job_row uuid; member_profile uuid; action_time timestamptz;
  imported integer:=0; missing integer:=0; comments_count integer:=0;
begin
  if not public.can_manage_department('GRAPHIC') then raise exception 'GRAPHIC manager permission required'; end if;
  if jsonb_typeof(rows_payload)<>'array' then raise exception 'payload must be an array'; end if;
  for item in select value from jsonb_array_elements(rows_payload) loop
    select id into job_row from public.graphic_jobs where trello_card_id=item->>'trello_card_id';
    if job_row is null then missing:=missing+1; continue; end if;
    action_time:=coalesce(nullif(item->>'created_at','')::timestamptz,now());
    member_profile:=null;
    if coalesce(item->>'trello_member_id','')<>'' then
      insert into public.graphic_trello_members(trello_member_id,username,full_name,avatar_url)
      values(left(item->>'trello_member_id',160),left(coalesce(item->>'username',''),160),left(coalesce(item->>'author_name',''),300),coalesce(item->>'author_avatar_url',''))
      on conflict(trello_member_id) do update set
        username=case when excluded.username<>'' then excluded.username else graphic_trello_members.username end,
        full_name=case when excluded.full_name<>'' then excluded.full_name else graphic_trello_members.full_name end,
        avatar_url=case when excluded.avatar_url<>'' then excluded.avatar_url else graphic_trello_members.avatar_url end,updated_at=now();
      select linked_profile_id into member_profile from public.graphic_trello_members where trello_member_id=item->>'trello_member_id';
    end if;
    insert into public.graphic_job_events(job_id,actor_id,event_type,note,payload,created_at,source_id)
    values(job_row,member_profile,left(coalesce(item->>'event_type','trello_activity'),120),left(coalesce(item->>'note',''),2000),
      coalesce(item->'payload','{}'::jsonb),action_time,left(item->>'source_id',160))
    on conflict(source_id) where source_id is not null do update set
      actor_id=excluded.actor_id,event_type=excluded.event_type,note=excluded.note,payload=excluded.payload,created_at=excluded.created_at;
    if item->>'event_type'='trello_comment' and coalesce(item->>'note','')<>'' then
      insert into public.graphic_job_comments(job_id,source_id,source,trello_member_id,author_profile_id,author_name,author_avatar_url,body,source_payload,created_at)
      values(job_row,left(item->>'source_id',160),'Trello',nullif(item->>'trello_member_id',''),member_profile,
        left(coalesce(item->>'author_name',''),300),coalesce(item->>'author_avatar_url',''),left(item->>'note',10000),
        coalesce(item->'payload','{}'::jsonb),action_time)
      on conflict(source_id) do update set author_profile_id=excluded.author_profile_id,author_name=excluded.author_name,
        author_avatar_url=excluded.author_avatar_url,body=excluded.body,source_payload=excluded.source_payload,created_at=excluded.created_at;
      comments_count:=comments_count+1;
    end if;
    imported:=imported+1;
  end loop;
  return jsonb_build_object('actions',imported,'comments',comments_count,'missing_card_actions',missing);
end $$;

create or replace function public.set_graphic_trello_member_link(
  p_trello_member_id text,p_email text default null,p_profile_id uuid default null
) returns public.graphic_trello_members language plpgsql security definer set search_path=public as $$
declare result public.graphic_trello_members%rowtype; profile_email text;
begin
  if not public.can_manage_department('GRAPHIC') then raise exception 'GRAPHIC manager permission required'; end if;
  if p_profile_id is not null then
    select email into profile_email from public.profiles where id=p_profile_id and active;
    if profile_email is null then raise exception 'active profile not found'; end if;
  end if;
  update public.graphic_trello_members set
    email=coalesce(nullif(lower(p_email),''),profile_email,email),linked_profile_id=p_profile_id,
    account_status=case when p_profile_id is not null then 'linked'
      when coalesce(nullif(lower(p_email),''),email) is not null then 'ready' else 'unlinked' end,
    updated_at=now()
  where trello_member_id=p_trello_member_id returning * into result;
  if result.trello_member_id is null then raise exception 'Trello member not found'; end if;
  update public.graphic_job_members set profile_id=p_profile_id where trello_member_id=p_trello_member_id;
  if p_profile_id is not null then
    update public.graphic_jobs j set assignee_id=p_profile_id,
      assignee_name=coalesce(nullif(result.full_name,''),(select display_name from public.profiles where id=p_profile_id),j.assignee_name)
    where exists(select 1 from public.graphic_job_members jm where jm.job_id=j.id and jm.trello_member_id=p_trello_member_id);
  end if;
  return result;
end $$;

grant select,insert,update on public.graphic_trello_members,public.graphic_job_members,public.graphic_job_comments to authenticated;
grant execute on function public.import_trello_graphic_members(jsonb) to authenticated;
grant execute on function public.import_trello_graphic_cards(jsonb) to authenticated;
grant execute on function public.import_trello_graphic_actions(jsonb) to authenticated;
grant execute on function public.set_graphic_trello_member_link(text,text,uuid) to authenticated;

comment on table public.graphic_trello_members is 'Trello member directory awaiting verified company email/profile linking.';
comment on table public.graphic_job_comments is 'Comments imported from Trello or created in Company Hub.';
