-- Announcement lifecycle: creators can edit/delete their own posts;
-- executives and administrators can moderate every announcement.
create or replace function public.can_manage_announcement(target_announcement uuid)
returns boolean language sql stable security definer set search_path=public
as $$
  select exists(
    select 1 from public.announcements a
    join public.profiles actor on actor.id=auth.uid() and actor.active
    where a.id=target_announcement
      and (a.creator_id=actor.id or actor.role in ('exec','admin'))
  )
$$;
revoke all on function public.can_manage_announcement(uuid) from public;
grant execute on function public.can_manage_announcement(uuid) to authenticated;

drop policy if exists "creators manage announcements" on public.announcements;
drop policy if exists "authorized users update announcements" on public.announcements;
create policy "authorized users update announcements" on public.announcements
for update to authenticated using (public.can_manage_announcement(id))
with check (public.can_manage_announcement(id));

drop policy if exists "authorized users delete announcements" on public.announcements;
create policy "authorized users delete announcements" on public.announcements
for delete to authenticated using (public.can_manage_announcement(id));

create or replace function public.update_announcement(
  p_announcement uuid, p_title text, p_body text, p_starts_on date,
  p_ends_on date, p_pinned boolean, p_recipients uuid[]
) returns uuid language plpgsql security definer set search_path=public
as $$
declare actor public.profiles%rowtype;
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

  update public.announcements set title=btrim(p_title),body=coalesce(p_body,''),
    starts_on=p_starts_on,ends_on=p_ends_on,pinned=coalesce(p_pinned,false)
  where id=p_announcement;
  -- Preserve acknowledgement timestamps for recipients that remain selected.
  delete from public.announcement_recipients r
  where r.announcement_id=p_announcement and not (r.profile_id=any(p_recipients));
  insert into public.announcement_recipients(announcement_id,profile_id)
  select p_announcement,x from unnest(p_recipients) x on conflict do nothing;
  return p_announcement;
end
$$;

create or replace function public.delete_announcement(p_announcement uuid)
returns boolean language plpgsql security definer set search_path=public
as $$
begin
  if not public.can_manage_announcement(p_announcement) then raise exception 'announcement management access required'; end if;
  delete from public.announcements where id=p_announcement;
  if not found then raise exception 'announcement not found'; end if;
  return true;
end
$$;

revoke all on function public.update_announcement(uuid,text,text,date,date,boolean,uuid[]) from public;
revoke all on function public.delete_announcement(uuid) from public;
grant execute on function public.update_announcement(uuid,text,text,date,date,boolean,uuid[]) to authenticated;
grant execute on function public.delete_announcement(uuid) to authenticated;
