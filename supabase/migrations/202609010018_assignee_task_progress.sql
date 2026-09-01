-- Allow an assigned employee to update progress and submit a proposed solution
-- without granting broad UPDATE/INSERT privileges on department records.

create or replace function public.update_my_task_progress(
  p_task uuid,
  p_status public.task_status
)
returns public.tasks
language plpgsql
security definer
set search_path=public
as $$
declare
  result public.tasks%rowtype;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if not exists(select 1 from public.profiles p where p.id=auth.uid() and p.active) then
    raise exception 'active profile required';
  end if;
  if not public.is_task_assignee(p_task) then raise exception 'task assignment required'; end if;
  if p_status='done' then raise exception 'manager approval required to close a task'; end if;

  update public.tasks
     set status=p_status, closed_at=null, updated_at=now(), version=version+1
   where id=p_task
   returning * into result;
  if result.id is null then raise exception 'task not found'; end if;

  insert into public.task_events(task_id,actor_id,event_type,payload)
  values(p_task,auth.uid(),'assignee_progress',jsonb_build_object('status',p_status));
  return result;
end
$$;

create or replace function public.submit_my_task_solution(
  p_task uuid,
  p_solution text
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  task_row public.tasks%rowtype;
  article_id uuid;
  clean_solution text:=btrim(coalesce(p_solution,''));
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if not exists(select 1 from public.profiles p where p.id=auth.uid() and p.active) then
    raise exception 'active profile required';
  end if;
  if char_length(clean_solution)<3 or char_length(clean_solution)>20000 then
    raise exception 'solution must contain 3-20000 characters';
  end if;
  if not (public.is_task_assignee(p_task) or public.can_manage_task(p_task)) then
    raise exception 'task assignment or manager access required';
  end if;

  select * into task_row from public.tasks where id=p_task;
  if task_row.id is null then raise exception 'task not found'; end if;

  select id into article_id
    from public.knowledge_articles
   where source_task_id=p_task and created_by=auth.uid() and status in ('draft','review')
   order by updated_at desc limit 1;

  if article_id is null then
    insert into public.knowledge_articles(
      source_task_id,department_code,title,problem,solution,status,created_by,prototype_payload
    ) values (
      task_row.id,task_row.department_code,task_row.title,coalesce(task_row.description,''),
      clean_solution,'review',auth.uid(),jsonb_build_object('submitted_by_assignee',true)
    ) returning id into article_id;
  else
    update public.knowledge_articles
       set solution=clean_solution,status='review',updated_at=now()
     where id=article_id;
  end if;

  update public.tasks
     set prototype_payload=jsonb_set(coalesce(prototype_payload,'{}'::jsonb),'{solution_proposal}',to_jsonb(clean_solution),true),
         updated_at=now(),version=version+1
   where id=p_task;

  insert into public.task_events(task_id,actor_id,event_type,payload)
  values(p_task,auth.uid(),'solution_submitted',jsonb_build_object('knowledge_article_id',article_id));
  return article_id;
end
$$;

revoke all on function public.update_my_task_progress(uuid,public.task_status) from public;
revoke all on function public.submit_my_task_solution(uuid,text) from public;
grant execute on function public.update_my_task_progress(uuid,public.task_status) to authenticated;
grant execute on function public.submit_my_task_solution(uuid,text) to authenticated;

-- Production announcements: replace the old browser-only announcement state.
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id),
  title text not null check (char_length(title) between 1 and 300),
  body text not null default '',
  starts_on date not null default current_date,
  ends_on date,
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  check (ends_on is null or ends_on>=starts_on)
);

create table if not exists public.announcement_recipients (
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  profile_id uuid not null references public.profiles(id),
  acknowledged_at timestamptz,
  primary key (announcement_id,profile_id)
);

create table if not exists public.announcement_comments (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  body text not null check (char_length(body) between 1 and 5000),
  created_at timestamptz not null default now()
);

alter table public.announcements enable row level security;
alter table public.announcement_recipients enable row level security;
alter table public.announcement_comments enable row level security;

create or replace function public.can_view_announcement(target_announcement uuid)
returns boolean
language sql stable security definer set search_path=public
as $$
  select exists(
    select 1 from public.announcements a
    where a.id=target_announcement and (
      a.creator_id=auth.uid()
      or not exists(select 1 from public.announcement_recipients r where r.announcement_id=a.id)
      or exists(select 1 from public.announcement_recipients r where r.announcement_id=a.id and r.profile_id=auth.uid())
    )
  )
$$;
revoke all on function public.can_view_announcement(uuid) from public;
grant execute on function public.can_view_announcement(uuid) to authenticated;

drop policy if exists "read addressed announcements" on public.announcements;
create policy "read addressed announcements" on public.announcements for select to authenticated
using (public.can_view_announcement(id));

drop policy if exists "leaders create announcements" on public.announcements;
create policy "leaders create announcements" on public.announcements for insert to authenticated
with check (
  creator_id=auth.uid() and exists(
    select 1 from public.profiles p where p.id=auth.uid() and p.active and p.role in ('lead','exec','admin')
  )
);

drop policy if exists "creators manage announcements" on public.announcements;
create policy "creators manage announcements" on public.announcements for update to authenticated
using (creator_id=auth.uid()) with check (creator_id=auth.uid());

drop policy if exists "read visible announcement recipients" on public.announcement_recipients;
create policy "read visible announcement recipients" on public.announcement_recipients for select to authenticated
using (public.can_view_announcement(announcement_id));

drop policy if exists "creators add announcement recipients" on public.announcement_recipients;
create policy "creators add announcement recipients" on public.announcement_recipients for insert to authenticated
with check (
  exists(select 1 from public.announcements a where a.id=announcement_id and a.creator_id=auth.uid())
  and exists(
    select 1 from public.profiles recipient, public.profiles actor
    where recipient.id=profile_id and actor.id=auth.uid() and actor.active
      and (actor.role in ('exec','admin') or (actor.role='lead' and public.can_manage_department(recipient.department_code)))
  )
);

drop policy if exists "recipients acknowledge announcements" on public.announcement_recipients;
create policy "recipients acknowledge announcements" on public.announcement_recipients for update to authenticated
using (profile_id=auth.uid()) with check (profile_id=auth.uid());

drop policy if exists "read visible announcement comments" on public.announcement_comments;
create policy "read visible announcement comments" on public.announcement_comments for select to authenticated
using (public.can_view_announcement(announcement_id));

drop policy if exists "write visible announcement comments" on public.announcement_comments;
create policy "write visible announcement comments" on public.announcement_comments for insert to authenticated
with check (author_id=auth.uid() and public.can_view_announcement(announcement_id));

create or replace function public.post_announcement(
  p_title text,
  p_body text,
  p_starts_on date,
  p_ends_on date,
  p_pinned boolean,
  p_recipients uuid[]
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  actor public.profiles%rowtype;
  new_announcement_id uuid;
begin
  select * into actor from public.profiles where id=auth.uid() and active;
  if actor.id is null or actor.role='staff' then raise exception 'leader access required'; end if;
  if char_length(btrim(coalesce(p_title,''))) not between 1 and 300 then raise exception 'invalid title'; end if;
  if p_ends_on is not null and p_ends_on<p_starts_on then raise exception 'invalid announcement period'; end if;
  if coalesce(array_length(p_recipients,1),0)=0 then raise exception 'at least one recipient required'; end if;
  if actor.role='lead' and exists(
    select 1 from unnest(p_recipients) recipient_id
    left join public.profiles p on p.id=recipient_id and p.active
    where p.id is null or not public.can_manage_department(p.department_code)
  ) then raise exception 'recipient outside managed departments'; end if;

  insert into public.announcements(creator_id,title,body,starts_on,ends_on,pinned)
  values(actor.id,btrim(p_title),coalesce(p_body,''),p_starts_on,p_ends_on,coalesce(p_pinned,false))
  returning id into new_announcement_id;
  insert into public.announcement_recipients(announcement_id,profile_id)
  select new_announcement_id,x from unnest(p_recipients) x on conflict do nothing;
  return new_announcement_id;
end
$$;

revoke all on function public.post_announcement(text,text,date,date,boolean,uuid[]) from public;
grant execute on function public.post_announcement(text,text,date,date,boolean,uuid[]) to authenticated;
