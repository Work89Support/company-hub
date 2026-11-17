-- Keep an audit trail for announcement edits and require recipients to acknowledge
-- the latest version again after any edit.
alter table public.announcements
  add column if not exists revision_no integer not null default 1,
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.announcement_revisions (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  revision_no integer not null,
  changed_by uuid not null references public.profiles(id),
  changed_at timestamptz not null default now(),
  previous_title text not null,
  previous_body text not null default '',
  previous_starts_on date not null,
  previous_ends_on date,
  previous_pinned boolean not null default false,
  previous_recipients uuid[] not null default '{}',
  change_summary text[] not null default '{}',
  unique (announcement_id,revision_no)
);

alter table public.announcement_revisions enable row level security;
drop policy if exists "read visible announcement revisions" on public.announcement_revisions;
create policy "read visible announcement revisions" on public.announcement_revisions
for select to authenticated using (public.can_view_announcement(announcement_id));

create or replace function public.update_announcement(
  p_announcement uuid, p_title text, p_body text, p_starts_on date,
  p_ends_on date, p_pinned boolean, p_recipients uuid[]
) returns uuid language plpgsql security definer set search_path=public
as $$
declare
  actor public.profiles%rowtype;
  previous public.announcements%rowtype;
  old_recipients uuid[];
  normalized_recipients uuid[];
  changes text[] := '{}';
begin
  select * into actor from public.profiles where id=auth.uid() and active;
  if actor.id is null or not public.can_manage_announcement(p_announcement) then
    raise exception 'announcement management access required';
  end if;
  if char_length(btrim(coalesce(p_title,''))) not between 1 and 300 then raise exception 'invalid title'; end if;
  if p_ends_on is not null and p_ends_on<p_starts_on then raise exception 'invalid announcement period'; end if;
  if coalesce(array_length(p_recipients,1),0)=0 then raise exception 'at least one recipient required'; end if;
  if actor.role='lead' and exists(
    select 1 from unnest(p_recipients) recipient_id
    left join public.profiles p on p.id=recipient_id and p.active
    where p.id is null or not public.can_manage_department(p.department_code)
  ) then raise exception 'recipient outside managed departments'; end if;

  select * into previous from public.announcements where id=p_announcement for update;
  if previous.id is null then raise exception 'announcement not found'; end if;
  select coalesce(array_agg(profile_id order by profile_id),'{}'::uuid[]) into old_recipients
  from public.announcement_recipients where announcement_id=p_announcement;
  select coalesce(array_agg(distinct x order by x),'{}'::uuid[]) into normalized_recipients
  from unnest(p_recipients) x;

  if previous.title is distinct from btrim(p_title) then changes:=array_append(changes,'หัวข้อ'); end if;
  if previous.body is distinct from coalesce(p_body,'') then changes:=array_append(changes,'รายละเอียด'); end if;
  if previous.starts_on is distinct from p_starts_on or previous.ends_on is distinct from p_ends_on then changes:=array_append(changes,'ช่วงวันที่'); end if;
  if previous.pinned is distinct from coalesce(p_pinned,false) then changes:=array_append(changes,'การปักหมุด'); end if;
  if old_recipients is distinct from normalized_recipients then changes:=array_append(changes,'รายชื่อผู้รับ'); end if;
  if coalesce(array_length(changes,1),0)=0 then return p_announcement; end if;

  insert into public.announcement_revisions(
    announcement_id,revision_no,changed_by,previous_title,previous_body,
    previous_starts_on,previous_ends_on,previous_pinned,previous_recipients,change_summary
  ) values (
    p_announcement,previous.revision_no,actor.id,previous.title,previous.body,
    previous.starts_on,previous.ends_on,previous.pinned,old_recipients,changes
  );

  update public.announcements set title=btrim(p_title),body=coalesce(p_body,''),
    starts_on=p_starts_on,ends_on=p_ends_on,pinned=coalesce(p_pinned,false),
    revision_no=previous.revision_no+1,updated_at=now()
  where id=p_announcement;
  delete from public.announcement_recipients r
  where r.announcement_id=p_announcement and not (r.profile_id=any(normalized_recipients));
  insert into public.announcement_recipients(announcement_id,profile_id)
  select p_announcement,x from unnest(normalized_recipients) x on conflict do nothing;
  -- An edit invalidates earlier acknowledgement so every current recipient sees it again.
  update public.announcement_recipients set acknowledged_at=null where announcement_id=p_announcement;
  return p_announcement;
end
$$;

revoke all on table public.announcement_revisions from public;
grant select on table public.announcement_revisions to authenticated;
revoke all on function public.update_announcement(uuid,text,text,date,date,boolean,uuid[]) from public;
grant execute on function public.update_announcement(uuid,text,text,date,date,boolean,uuid[]) to authenticated;
