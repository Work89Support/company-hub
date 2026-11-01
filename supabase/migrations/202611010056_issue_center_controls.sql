-- Issue Center evidence, risk-based closure and audited bulk closure.

alter table public.operational_issues
  add column if not exists close_reason text not null default '';

create table if not exists public.issue_attachments (
  id uuid primary key default gen_random_uuid(),
  issue_id text not null references public.operational_issues(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null,
  file_size bigint not null check (file_size > 0 and file_size <= 10485760),
  uploaded_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists issue_attachments_issue_idx
  on public.issue_attachments(issue_id, created_at desc);

create table if not exists public.issue_bulk_actions (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.profiles(id),
  action text not null check (action in ('resolve')),
  issue_ids text[] not null,
  reason text not null,
  solution text not null,
  created_at timestamptz not null default now()
);

alter table public.issue_attachments enable row level security;
alter table public.issue_bulk_actions enable row level security;

drop policy if exists "visible issue attachments read" on public.issue_attachments;
create policy "visible issue attachments read" on public.issue_attachments
for select to authenticated using (
  exists (
    select 1 from public.operational_issues i
    where i.id=issue_id and public.can_view_department(i.department_code)
  )
);

drop policy if exists "visible issue attachments insert" on public.issue_attachments;
create policy "visible issue attachments insert" on public.issue_attachments
for insert to authenticated with check (
  uploaded_by=auth.uid()
  and exists (
    select 1 from public.operational_issues i
    where i.id=issue_id and public.can_view_department(i.department_code)
  )
);

drop policy if exists "issue attachment owner delete" on public.issue_attachments;
create policy "issue attachment owner delete" on public.issue_attachments
for delete to authenticated using (
  uploaded_by=auth.uid()
  or exists (
    select 1 from public.operational_issues i
    where i.id=issue_id and public.can_manage_department(i.department_code)
  )
);

drop policy if exists "bulk issue actions visible" on public.issue_bulk_actions;
create policy "bulk issue actions visible" on public.issue_bulk_actions
for select to authenticated using (
  actor_id=auth.uid() or public.is_access_admin()
);

grant select, insert, delete on public.issue_attachments to authenticated;
grant select on public.issue_bulk_actions to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values (
  'issue-evidence',
  'issue-evidence',
  false,
  10485760,
  array['image/jpeg','image/png','image/webp','image/gif']
)
on conflict (id) do update set
  public=false,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "visible issue evidence read" on storage.objects;
create policy "visible issue evidence read" on storage.objects
for select to authenticated using (
  bucket_id='issue-evidence'
  and exists (
    select 1 from public.operational_issues i
    where i.id=(storage.foldername(name))[1]
      and public.can_view_department(i.department_code)
  )
);

drop policy if exists "visible issue evidence upload" on storage.objects;
create policy "visible issue evidence upload" on storage.objects
for insert to authenticated with check (
  bucket_id='issue-evidence'
  and exists (
    select 1 from public.operational_issues i
    where i.id=(storage.foldername(name))[1]
      and public.can_view_department(i.department_code)
  )
);

drop policy if exists "issue evidence owner delete" on storage.objects;
create policy "issue evidence owner delete" on storage.objects
for delete to authenticated using (
  bucket_id='issue-evidence'
  and exists (
    select 1
    from public.issue_attachments a
    join public.operational_issues i on i.id=a.issue_id
    where a.storage_path=name
      and (a.uploaded_by=auth.uid() or public.can_manage_department(i.department_code))
  )
);

create or replace function public.can_close_operational_issue(issue public.operational_issues)
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists (
    select 1
    from public.profiles caller
    left join public.profiles creator on creator.id=issue.created_by
    where caller.id=auth.uid()
      and caller.active
      and (
        caller.role in ('exec','admin')
        or public.can_manage_department(issue.department_code)
        or (
          issue.priority='Low'
          and public.can_view_department(issue.department_code)
          and (
            issue.created_by=caller.id
            or issue.owner_profile_id=caller.id
            or (
              nullif(caller.team_code,'') is not null
              and caller.team_code=creator.team_code
            )
          )
        )
      )
  )
$$;

grant execute on function public.can_close_operational_issue(public.operational_issues) to authenticated;

create or replace function public.save_verified_issue_resolution(
  target_issue text,
  next_status text,
  next_owner text,
  next_root_cause text,
  next_solution_type text,
  next_solution text,
  next_preventive_action text,
  next_resolution_minutes numeric,
  next_reference_type text default '',
  next_reference_id text default '',
  confirm_effective boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  caller public.profiles%rowtype;
  issue public.operational_issues%rowtype;
  manager boolean := false;
  reference_ok boolean := false;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select * into caller from public.profiles where id=auth.uid() and active;
  if caller.id is null then raise exception 'active profile required'; end if;
  select * into issue from public.operational_issues where id=target_issue for update;
  if issue.id is null then raise exception 'operational issue not found'; end if;

  manager := caller.role in ('exec','admin') or public.can_manage_department(issue.department_code);
  if next_status='Resolved' then
    if not public.can_close_operational_issue(issue) then
      raise exception 'this risk level requires a head or assistant head to close';
    end if;
  elsif not manager then
    raise exception 'department management permission required';
  end if;

  if next_status not in ('Open','In Progress','Resolved') then raise exception 'invalid issue status'; end if;
  if coalesce(next_solution_type,'') not in ('','unresolved','temporary','reuse','onsite','provider','permanent','new_sop') then raise exception 'invalid solution type'; end if;
  if coalesce(next_reference_type,'') not in ('','issue','sop','knowledge') then raise exception 'invalid solution reference type'; end if;
  if next_resolution_minutes is not null and next_resolution_minutes<0 then raise exception 'resolution minutes must be zero or greater'; end if;
  if char_length(trim(coalesce(next_root_cause,'')))>500 then raise exception 'root cause is too long'; end if;
  if char_length(trim(coalesce(next_solution,'')))>4000 then raise exception 'solution is too long'; end if;
  if char_length(trim(coalesce(next_preventive_action,'')))>4000 then raise exception 'preventive action is too long'; end if;

  if coalesce(next_reference_type,'')='' then
    next_reference_id := '';
  else
    if trim(coalesce(next_reference_id,''))='' then raise exception 'solution reference is required'; end if;
    if next_reference_type='issue' then
      if next_reference_id=target_issue then raise exception 'an issue cannot reference itself'; end if;
      select exists(select 1 from public.operational_issues r where r.id=next_reference_id and trim(r.solution)<>'' and public.can_view_department(r.department_code)) into reference_ok;
    elsif next_reference_type='sop' then
      select exists(select 1 from public.sops r where r.id::text=next_reference_id and (r.status='published' or public.can_manage_department(r.department_code))) into reference_ok;
    elsif next_reference_type='knowledge' then
      select exists(select 1 from public.knowledge_articles r where r.id::text=next_reference_id and (r.status='published' or public.can_manage_department(r.department_code))) into reference_ok;
    end if;
    if not reference_ok then raise exception 'solution reference not found or not visible'; end if;
  end if;

  if next_solution_type='reuse' and coalesce(next_reference_type,'')='' then raise exception 'a reused solution must link to an existing case, SOP, or knowledge article'; end if;
  if next_status='Resolved' then
    if trim(coalesce(next_solution,''))='' then raise exception 'solution is required before resolving'; end if;
    if not confirm_effective then raise exception 'confirm that the solution was tested and worked'; end if;
  end if;

  update public.operational_issues set
    status=next_status,
    owner_team=left(trim(coalesce(next_owner,'')),200),
    root_cause=trim(coalesce(next_root_cause,'')),
    solution_type=coalesce(next_solution_type,''),
    solution=trim(coalesce(next_solution,'')),
    preventive_action=trim(coalesce(next_preventive_action,'')),
    resolution_minutes=next_resolution_minutes,
    solution_reference_type=coalesce(next_reference_type,''),
    solution_reference_id=coalesce(next_reference_id,''),
    solution_verified=(next_status='Resolved' and confirm_effective),
    solution_verified_by=case when next_status='Resolved' and confirm_effective then caller.id else null end,
    solution_verified_at=case when next_status='Resolved' and confirm_effective then now() else null end,
    resolved_at=case when next_status='Resolved' then coalesce(resolved_at,now()) else null end
  where id=target_issue returning * into issue;

  return jsonb_build_object('id',issue.id,'status',issue.status,'solution_verified',issue.solution_verified,'solution_verified_at',issue.solution_verified_at,'updated_at',issue.updated_at);
end
$$;

revoke all on function public.save_verified_issue_resolution(text,text,text,text,text,text,text,numeric,text,text,boolean) from public;
grant execute on function public.save_verified_issue_resolution(text,text,text,text,text,text,text,numeric,text,text,boolean) to authenticated;

create or replace function public.bulk_close_operational_issues(
  target_issues text[],
  close_reason text,
  resolution_solution text,
  confirm_effective boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  caller public.profiles%rowtype;
  issue public.operational_issues%rowtype;
  clean_ids text[];
  changed_count integer := 0;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select * into caller from public.profiles where id=auth.uid() and active;
  if caller.id is null then raise exception 'active profile required'; end if;

  select array_agg(distinct trim(v))
  into clean_ids
  from unnest(coalesce(target_issues,array[]::text[])) v
  where trim(v)<>'';

  if coalesce(array_length(clean_ids,1),0)=0 then raise exception 'select at least one issue'; end if;
  if array_length(clean_ids,1)>100 then raise exception 'a bulk action is limited to 100 issues'; end if;
  if char_length(trim(coalesce($2,'')))<5 then raise exception 'close reason must be at least 5 characters'; end if;
  if trim(coalesce(resolution_solution,''))='' then raise exception 'solution is required'; end if;
  if not confirm_effective then raise exception 'confirm that the solution was tested and worked'; end if;

  if (select count(*) from public.operational_issues where id=any(clean_ids))
      <> array_length(clean_ids,1) then
    raise exception 'one or more issues were not found';
  end if;

  for issue in
    select * from public.operational_issues
    where id=any(clean_ids)
    order by id
    for update
  loop
    if issue.status='Resolved' then raise exception 'issue % is already resolved',issue.id; end if;
    if not public.can_close_operational_issue(issue) then
      raise exception 'you cannot close issue % at risk level %',issue.id,issue.priority;
    end if;
  end loop;

  update public.operational_issues
  set status='Resolved',
      solution_type=case when solution_type in ('','unresolved') then 'permanent' else solution_type end,
      solution=trim(resolution_solution),
      close_reason=trim($2),
      resolution_minutes=coalesce(resolution_minutes,greatest(0,round(extract(epoch from (now()-occurred_at))/60))),
      solution_verified=true,
      solution_verified_by=caller.id,
      solution_verified_at=now(),
      resolved_at=coalesce(resolved_at,now())
  where id=any(clean_ids);
  get diagnostics changed_count=row_count;

  insert into public.issue_bulk_actions(actor_id,action,issue_ids,reason,solution)
  values(caller.id,'resolve',clean_ids,trim($2),trim(resolution_solution));

  return jsonb_build_object('closed',changed_count,'issue_ids',clean_ids,'closed_by',caller.id,'closed_at',now());
end
$$;

revoke all on function public.bulk_close_operational_issues(text[],text,text,boolean) from public;
grant execute on function public.bulk_close_operational_issues(text[],text,text,boolean) to authenticated;

comment on function public.bulk_close_operational_issues(text[],text,text,boolean) is
  'Atomically closes selected issues with one audited reason. Low-risk cases may be closed by their creator, assignee or same-team staff; Medium/High/Critical require a department manager or access admin.';
