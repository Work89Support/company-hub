-- Telegram-style Company Hub chat rooms, direct messages and private attachments.

create table if not exists public.chat_rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 80),
  room_type text not null check (room_type in ('public','group','direct')),
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chat_room_members (
  room_id uuid not null references public.chat_rooms(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  member_role text not null default 'member' check (member_role in ('owner','member')),
  joined_at timestamptz not null default now(),
  primary key (room_id,profile_id)
);

create index if not exists chat_room_members_profile_idx
  on public.chat_room_members(profile_id,room_id);
create index if not exists chat_rooms_updated_idx
  on public.chat_rooms(updated_at desc);

insert into public.chat_rooms(id,name,room_type,created_by)
values('00000000-0000-0000-0000-000000000001','ห้องกลาง Company Hub','public',null)
on conflict(id) do update set name=excluded.name,room_type='public';

alter table public.support_chat_messages
  add column if not exists room_id uuid references public.chat_rooms(id) on delete cascade,
  add column if not exists attachment_path text,
  add column if not exists attachment_name text,
  add column if not exists attachment_mime text,
  add column if not exists attachment_size bigint;

update public.support_chat_messages
set room_id='00000000-0000-0000-0000-000000000001'
where room_id is null;

alter table public.support_chat_messages alter column room_id set not null;
alter table public.support_chat_messages alter column body set default '';
alter table public.support_chat_messages drop constraint if exists support_chat_messages_message_type_check;
alter table public.support_chat_messages drop constraint if exists support_chat_messages_body_check;
alter table public.support_chat_messages
  add constraint support_chat_messages_message_type_check
  check (message_type in ('message','problem','update')),
  add constraint support_chat_messages_content_check
  check (
    char_length(trim(coalesce(body,''))) <= 2000
    and (char_length(trim(coalesce(body,''))) > 0 or attachment_path is not null)
  ),
  add constraint support_chat_messages_attachment_size_check
  check (attachment_size is null or attachment_size between 1 and 10485760);

create index if not exists support_chat_messages_room_created_idx
  on public.support_chat_messages(room_id,created_at desc);

create or replace function public.is_active_company_user()
returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.profiles where id=auth.uid() and active) $$;

create or replace function public.can_access_chat_room(p_room_id uuid)
returns boolean language sql stable security definer set search_path=public
as $$
  select public.is_active_company_user() and exists(
    select 1 from public.chat_rooms r
    where r.id=p_room_id and (
      r.room_type='public'
      or exists(select 1 from public.chat_room_members m where m.room_id=r.id and m.profile_id=auth.uid())
    )
  )
$$;

create or replace function public.chat_directory()
returns table(profile_id uuid,display_name text,department_code text,position_title text)
language sql stable security definer set search_path=public
as $$
  select p.id,coalesce(nullif(trim(p.display_name),''),p.email),p.department_code,p.position_title
  from public.profiles p
  where public.is_active_company_user() and p.active and p.id<>auth.uid()
  order by coalesce(nullif(trim(p.display_name),''),p.email)
$$;

create or replace function public.create_chat_room(
  p_room_type text,
  p_name text,
  p_member_ids uuid[]
) returns uuid
language plpgsql security definer set search_path=public
as $$
declare
  v_room_id uuid;
  v_member_ids uuid[];
  v_target_name text;
begin
  if not public.is_active_company_user() then raise exception 'active profile required'; end if;
  if p_room_type not in ('group','direct') then raise exception 'invalid room type'; end if;

  select coalesce(array_agg(distinct p.id),'{}'::uuid[])
  into v_member_ids
  from public.profiles p
  where p.active and p.id=any(coalesce(p_member_ids,'{}'::uuid[])) and p.id<>auth.uid();

  if p_room_type='direct' and coalesce(array_length(v_member_ids,1),0)<>1 then
    raise exception 'direct chat requires one member';
  end if;
  if p_room_type='group' and coalesce(array_length(v_member_ids,1),0)<1 then
    raise exception 'group requires at least one other member';
  end if;

  if p_room_type='direct' then
    select coalesce(nullif(trim(display_name),''),email) into v_target_name
    from public.profiles where id=v_member_ids[1];
  elsif char_length(trim(coalesce(p_name,'')))<1 then
    raise exception 'group name is required';
  end if;

  insert into public.chat_rooms(name,room_type,created_by)
  values(case when p_room_type='direct' then coalesce(v_target_name,'แชทส่วนตัว') else left(trim(p_name),80) end,p_room_type,auth.uid())
  returning id into v_room_id;

  insert into public.chat_room_members(room_id,profile_id,member_role)
  values(v_room_id,auth.uid(),'owner');
  insert into public.chat_room_members(room_id,profile_id,member_role)
  select v_room_id,member_id,'member' from unnest(v_member_ids) member_id;
  return v_room_id;
end
$$;

create or replace function public.set_support_chat_author()
returns trigger language plpgsql security definer set search_path=public
as $$
declare v_profile public.profiles%rowtype;
begin
  select * into v_profile from public.profiles where id=auth.uid() and active;
  if not found then raise exception 'active profile required'; end if;
  if new.room_id is null then new.room_id := '00000000-0000-0000-0000-000000000001'; end if;
  if not public.can_access_chat_room(new.room_id) then raise exception 'room access denied'; end if;
  new.author_id := auth.uid();
  new.author_name := coalesce(nullif(trim(v_profile.display_name),''),v_profile.email);
  new.department_code := v_profile.department_code;
  new.body := trim(coalesce(new.body,''));
  if new.attachment_path is not null and split_part(new.attachment_path,'/',1)<>new.room_id::text then
    raise exception 'attachment path does not match room';
  end if;
  return new;
end
$$;

create or replace function public.touch_chat_room()
returns trigger language plpgsql security definer set search_path=public
as $$ begin update public.chat_rooms set updated_at=now() where id=new.room_id; return new; end $$;
drop trigger if exists touch_chat_room_after_message on public.support_chat_messages;
create trigger touch_chat_room_after_message after insert on public.support_chat_messages
for each row execute function public.touch_chat_room();

alter table public.chat_rooms enable row level security;
alter table public.chat_room_members enable row level security;
alter table public.support_chat_messages enable row level security;

drop policy if exists "active users read chat rooms" on public.chat_rooms;
create policy "active users read chat rooms" on public.chat_rooms for select to authenticated
using (public.can_access_chat_room(id));

drop policy if exists "room members read memberships" on public.chat_room_members;
create policy "room members read memberships" on public.chat_room_members for select to authenticated
using (public.can_access_chat_room(room_id));

drop policy if exists "active users read shared support chat" on public.support_chat_messages;
drop policy if exists "active users send shared support chat" on public.support_chat_messages;
drop policy if exists "room members read chat messages" on public.support_chat_messages;
drop policy if exists "room members send chat messages" on public.support_chat_messages;
create policy "room members read chat messages" on public.support_chat_messages for select to authenticated
using (public.can_access_chat_room(room_id));
create policy "room members send chat messages" on public.support_chat_messages for insert to authenticated
with check (author_id=auth.uid() and public.can_access_chat_room(room_id));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
  'chat-attachments','chat-attachments',false,10485760,
  array['image/jpeg','image/png','image/webp','image/gif','application/pdf','text/plain','text/csv','application/zip','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.openxmlformats-officedocument.presentationml.presentation']
)
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create or replace function public.chat_room_from_storage_path(p_name text)
returns uuid language plpgsql immutable set search_path=public
as $$ begin return split_part(p_name,'/',1)::uuid; exception when others then return null; end $$;

drop policy if exists "chat members read attachments" on storage.objects;
drop policy if exists "chat members upload attachments" on storage.objects;
drop policy if exists "chat senders delete attachments" on storage.objects;
create policy "chat members read attachments" on storage.objects for select to authenticated
using (bucket_id='chat-attachments' and public.can_access_chat_room(public.chat_room_from_storage_path(name)));
create policy "chat members upload attachments" on storage.objects for insert to authenticated
with check (
  bucket_id='chat-attachments'
  and public.can_access_chat_room(public.chat_room_from_storage_path(name))
  and split_part(name,'/',2)=auth.uid()::text
);
create policy "chat senders delete attachments" on storage.objects for delete to authenticated
using (bucket_id='chat-attachments' and split_part(name,'/',2)=auth.uid()::text);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='chat_rooms'
  ) then alter publication supabase_realtime add table public.chat_rooms; end if;
end
$$;

revoke all on function public.chat_directory() from public;
revoke all on function public.create_chat_room(text,text,uuid[]) from public;
grant execute on function public.chat_directory() to authenticated;
grant execute on function public.create_chat_room(text,text,uuid[]) to authenticated;
grant select on public.chat_rooms,public.chat_room_members to authenticated;
grant select,insert on public.support_chat_messages to authenticated;
