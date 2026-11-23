-- Give every verified Graphic Production assignee the same card-edit rights.
-- Previously only graphic_jobs.assignee_id (one person) could move a card or
-- write graphic_job_files. Imported Trello cards may have several members in
-- graphic_job_members, so secondary assignees were displayed but blocked by RLS.
begin;

-- Repair deterministic links first. Email is preferred; normalized display
-- name is used only when exactly one active GRAPHIC profile matches.
with email_candidates as (
  select m.trello_member_id,p.id,
    count(*) over(partition by m.trello_member_id) as matches
  from public.graphic_trello_members m
  join public.profiles p on p.active and p.department_code='GRAPHIC'
   and nullif(lower(btrim(m.email)),'')=lower(btrim(p.email))
), unique_email as (
  select trello_member_id,id from email_candidates where matches=1
), name_candidates as (
  select m.trello_member_id,p.id,
    count(*) over(partition by m.trello_member_id) as matches
  from public.graphic_trello_members m
  join public.profiles p on p.active and p.department_code='GRAPHIC'
   and regexp_replace(lower(m.full_name),'[^[:alnum:]]','','g')=
       regexp_replace(lower(split_part(p.display_name,'(',1)),'[^[:alnum:]]','','g')
  where nullif(regexp_replace(lower(m.full_name),'[^[:alnum:]]','','g'),'') is not null
), unique_name as (
  select trello_member_id,id from name_candidates where matches=1
), resolved as (
  select m.trello_member_id,coalesce(e.id,n.id) as profile_id
  from public.graphic_trello_members m
  left join unique_email e using(trello_member_id)
  left join unique_name n using(trello_member_id)
)
update public.graphic_trello_members m
set linked_profile_id=r.profile_id,
    account_status='linked',
    updated_at=now()
from resolved r
where r.trello_member_id=m.trello_member_id
  and r.profile_id is not null
  and m.linked_profile_id is distinct from r.profile_id;

update public.graphic_job_members jm
set profile_id=m.linked_profile_id
from public.graphic_trello_members m
where m.trello_member_id=jm.trello_member_id
  and m.linked_profile_id is not null
  and jm.profile_id is distinct from m.linked_profile_id;

create or replace function public.can_edit_graphic_job(p_job_id uuid)
returns boolean language sql stable security definer set search_path=public
as $$
  with actor as (
    select p.id,p.email,p.display_name,
      regexp_replace(lower(split_part(p.display_name,'(',1)),'[^[:alnum:]]','','g') as normalized_name
    from public.profiles p
    where p.id=auth.uid() and p.active
  )
  select exists(
    select 1
    from public.graphic_jobs j
    where j.id=p_job_id and (
      j.assignee_id=auth.uid()
      or j.created_by=auth.uid()
      or public.can_manage_department(j.department_code)
      or exists(
        select 1
        from jsonb_array_elements_text(
          case
            when jsonb_typeof(j.source_payload->'assignee_profile_ids')='array'
              then j.source_payload->'assignee_profile_ids'
            else '[]'::jsonb
          end
        ) assigned(profile_id)
        where assigned.profile_id=auth.uid()::text
      )
      or exists(
        select 1
        from public.graphic_job_members jm
        left join public.graphic_trello_members tm on tm.trello_member_id=jm.trello_member_id
        cross join actor a
        where jm.job_id=j.id and (
          jm.profile_id=a.id
          or tm.linked_profile_id=a.id
          or (nullif(lower(btrim(tm.email)),'') is not null and lower(btrim(tm.email))=lower(btrim(a.email)))
          or (
            a.normalized_name<>''
            and regexp_replace(lower(tm.full_name),'[^[:alnum:]]','','g')=a.normalized_name
            and 1=(
              select count(*) from public.profiles px
              where px.active and px.department_code='GRAPHIC'
                and regexp_replace(lower(split_part(px.display_name,'(',1)),'[^[:alnum:]]','','g')=a.normalized_name
            )
          )
        )
      )
    )
  )
$$;

-- Keep the existing status bookkeeping, but authorize every verified member
-- instead of only the single legacy assignee_id.
create or replace function public.move_graphic_job(target_job uuid, next_status text, event_note text default '')
returns public.graphic_jobs language plpgsql security definer set search_path=public as $$
declare current_job public.graphic_jobs%rowtype; result public.graphic_jobs%rowtype;
begin
  if next_status not in ('intake','brief','doing','review','revision','monthly','done') then raise exception 'invalid status'; end if;
  select * into current_job from public.graphic_jobs where id=target_job;
  if current_job.id is null then raise exception 'job not found'; end if;
  if not public.can_edit_graphic_job(target_job) then raise exception 'permission denied'; end if;
  update public.graphic_jobs set status=next_status,
    revision_count=revision_count + case when next_status='revision' and status<>'revision' then 1 else 0 end,
    started_at=case when next_status='doing' then coalesce(started_at,now()) else started_at end,
    submitted_at=case when next_status='review' then now() else submitted_at end,
    completed_at=case when next_status='done' then now() else null end
  where id=target_job returning * into result;
  insert into public.graphic_job_events(job_id,actor_id,event_type,note,payload)
  values(target_job,auth.uid(),'status_changed',left(coalesce(event_note,''),2000),jsonb_build_object('from',current_job.status,'to',next_status));
  return result;
end $$;

drop policy if exists "write graphic files" on public.graphic_job_files;
create policy "write graphic files" on public.graphic_job_files for insert to authenticated
with check (created_by=auth.uid() and public.can_edit_graphic_job(job_id));

revoke all on function public.can_edit_graphic_job(uuid) from public;
revoke all on function public.move_graphic_job(uuid,text,text) from public;
grant execute on function public.can_edit_graphic_job(uuid) to authenticated;
grant execute on function public.move_graphic_job(uuid,text,text) to authenticated;

commit;
