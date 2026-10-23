-- Personal Graphic Production workflow, editable links and private brief images.
begin;

alter table public.graphic_job_files
  add column if not exists storage_path text;

create or replace function public.can_edit_graphic_job(p_job_id uuid)
returns boolean language sql stable security definer set search_path=public
as $$
  select exists(
    select 1 from public.graphic_jobs j
    where j.id=p_job_id and (
      j.assignee_id=auth.uid()
      or j.created_by=auth.uid()
      or public.can_manage_department(j.department_code)
      or exists(
        select 1 from public.graphic_job_members jm
        left join public.graphic_trello_members tm on tm.trello_member_id=jm.trello_member_id
        where jm.job_id=j.id and coalesce(jm.profile_id,tm.linked_profile_id)=auth.uid()
      )
    )
  )
$$;

create or replace function public.can_view_graphic_job(p_job_id uuid)
returns boolean language sql stable security definer set search_path=public
as $$
  select exists(select 1 from public.graphic_jobs j where j.id=p_job_id and public.can_view_department(j.department_code))
$$;

drop policy if exists "write graphic checklist" on public.graphic_job_checklist_items;
create policy "write graphic checklist" on public.graphic_job_checklist_items for all to authenticated
using (public.can_edit_graphic_job(job_id))
with check (public.can_edit_graphic_job(job_id));

drop policy if exists "write graphic files" on public.graphic_job_files;
create policy "write graphic files" on public.graphic_job_files for insert to authenticated
with check (created_by=auth.uid() and public.can_edit_graphic_job(job_id));
drop policy if exists "manage graphic files" on public.graphic_job_files;
create policy "manage graphic files" on public.graphic_job_files for update to authenticated
using (public.can_edit_graphic_job(job_id)) with check (public.can_edit_graphic_job(job_id));
drop policy if exists "delete graphic files" on public.graphic_job_files;
create policy "delete graphic files" on public.graphic_job_files for delete to authenticated
using (public.can_edit_graphic_job(job_id));

-- Old Trello links must not masquerade as active accounts.
update public.graphic_trello_members m
set linked_profile_id=null,
    account_status=case when m.email is null then 'unlinked' else 'ready' end,
    updated_at=now()
where m.linked_profile_id is not null
  and not exists(select 1 from public.profiles p where p.id=m.linked_profile_id and p.active);

-- Auto-link only deterministic normalized-name matches. No fuzzy or guessed assignment.
with candidates as (
  select m.trello_member_id,p.id,
    count(*) over(partition by m.trello_member_id) as matches
  from public.graphic_trello_members m
  join public.profiles p on p.active and p.department_code='GRAPHIC'
   and regexp_replace(lower(m.full_name),'[ ._-]','','g')=
       regexp_replace(lower(split_part(p.display_name,'(',1)),'[ ._-]','','g')
)
update public.graphic_trello_members m
set linked_profile_id=c.id,account_status='linked',updated_at=now()
from candidates c where c.matches=1 and c.trello_member_id=m.trello_member_id;

update public.graphic_job_members jm set profile_id=m.linked_profile_id
from public.graphic_trello_members m
where m.trello_member_id=jm.trello_member_id
  and jm.profile_id is distinct from m.linked_profile_id;

update public.graphic_jobs j
set assignee_id=m.linked_profile_id,
    assignee_name=coalesce(nullif(p.display_name,''),j.assignee_name)
from public.graphic_job_members jm
join public.graphic_trello_members m on m.trello_member_id=jm.trello_member_id
join public.profiles p on p.id=m.linked_profile_id and p.active
where jm.job_id=j.id and j.assignee_id is null;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('graphic-job-files','graphic-job-files',false,10485760,array['image/jpeg','image/png','image/webp','image/gif'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create or replace function public.graphic_job_from_storage_path(p_name text)
returns uuid language plpgsql immutable set search_path=public
as $$ begin return split_part(p_name,'/',1)::uuid; exception when others then return null; end $$;

drop policy if exists "graphic users read job files" on storage.objects;
drop policy if exists "graphic editors upload job files" on storage.objects;
drop policy if exists "graphic editors delete job files" on storage.objects;
create policy "graphic users read job files" on storage.objects for select to authenticated
using (bucket_id='graphic-job-files' and public.can_view_graphic_job(public.graphic_job_from_storage_path(name)));
create policy "graphic editors upload job files" on storage.objects for insert to authenticated
with check (
  bucket_id='graphic-job-files'
  and split_part(name,'/',2)=auth.uid()::text
  and public.can_edit_graphic_job(public.graphic_job_from_storage_path(name))
);
create policy "graphic editors delete job files" on storage.objects for delete to authenticated
using (
  bucket_id='graphic-job-files'
  and public.can_edit_graphic_job(public.graphic_job_from_storage_path(name))
);

revoke all on function public.can_edit_graphic_job(uuid) from public;
revoke all on function public.can_view_graphic_job(uuid) from public;
grant execute on function public.can_edit_graphic_job(uuid) to authenticated;
grant execute on function public.can_view_graphic_job(uuid) to authenticated;

commit;
