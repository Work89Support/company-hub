-- Verified issue resolution and reusable solution references.
-- A case can be marked Resolved only after a manager confirms that the
-- recorded solution was actually tested and worked.

alter table public.operational_issues
  add column if not exists solution_type text not null default ''
    check (solution_type in ('','unresolved','temporary','reuse','onsite','provider','permanent','new_sop')),
  add column if not exists solution_reference_type text not null default ''
    check (solution_reference_type in ('','issue','sop','knowledge')),
  add column if not exists solution_reference_id text not null default '',
  add column if not exists solution_verified boolean not null default false,
  add column if not exists solution_verified_by uuid references public.profiles(id) on delete set null,
  add column if not exists solution_verified_at timestamptz;

create index if not exists operational_issues_solution_reference_idx
  on public.operational_issues(solution_reference_type, solution_reference_id)
  where solution_reference_type<>'';

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
  reference_ok boolean := false;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;

  select * into caller from public.profiles where id=auth.uid() and active;
  if caller.id is null then raise exception 'active profile required'; end if;

  select * into issue from public.operational_issues where id=target_issue;
  if issue.id is null then raise exception 'operational issue not found'; end if;
  if not (caller.role in ('exec','admin') or public.can_manage_department(issue.department_code)) then
    raise exception 'department management permission required';
  end if;

  if next_status not in ('Open','In Progress','Resolved') then
    raise exception 'invalid issue status';
  end if;
  if coalesce(next_solution_type,'') not in ('','unresolved','temporary','reuse','onsite','provider','permanent','new_sop') then
    raise exception 'invalid solution type';
  end if;
  if coalesce(next_reference_type,'') not in ('','issue','sop','knowledge') then
    raise exception 'invalid solution reference type';
  end if;
  if next_resolution_minutes is not null and next_resolution_minutes < 0 then
    raise exception 'resolution minutes must be zero or greater';
  end if;
  if char_length(trim(coalesce(next_root_cause,''))) > 500 then raise exception 'root cause is too long'; end if;
  if char_length(trim(coalesce(next_solution,''))) > 4000 then raise exception 'solution is too long'; end if;
  if char_length(trim(coalesce(next_preventive_action,''))) > 4000 then raise exception 'preventive action is too long'; end if;

  if coalesce(next_reference_type,'')='' then
    next_reference_id := '';
  else
    if trim(coalesce(next_reference_id,''))='' then raise exception 'solution reference is required'; end if;
    if next_reference_type='issue' then
      if next_reference_id=target_issue then raise exception 'an issue cannot reference itself'; end if;
      select exists(
        select 1 from public.operational_issues r
        where r.id=next_reference_id and trim(r.solution)<>'' and public.can_view_department(r.department_code)
      ) into reference_ok;
    elsif next_reference_type='sop' then
      select exists(
        select 1 from public.sops r
        where r.id::text=next_reference_id
          and (r.status='published' or public.can_manage_department(r.department_code))
      ) into reference_ok;
    elsif next_reference_type='knowledge' then
      select exists(
        select 1 from public.knowledge_articles r
        where r.id::text=next_reference_id
          and (r.status='published' or public.can_manage_department(r.department_code))
      ) into reference_ok;
    end if;
    if not reference_ok then raise exception 'solution reference not found or not visible'; end if;
  end if;

  if next_solution_type='reuse' and coalesce(next_reference_type,'')='' then
    raise exception 'a reused solution must link to an existing case, SOP, or knowledge article';
  end if;
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
    solution_verified_at=case when next_status='Resolved' and confirm_effective then now() else null end
  where id=target_issue
  returning * into issue;

  return jsonb_build_object(
    'id',issue.id,
    'status',issue.status,
    'solution_type',issue.solution_type,
    'solution_reference_type',issue.solution_reference_type,
    'solution_reference_id',issue.solution_reference_id,
    'solution_verified',issue.solution_verified,
    'solution_verified_by',issue.solution_verified_by,
    'solution_verified_at',issue.solution_verified_at,
    'updated_at',issue.updated_at
  );
end
$$;

revoke all on function public.save_verified_issue_resolution(text,text,text,text,text,text,text,numeric,text,text,boolean) from public;
grant execute on function public.save_verified_issue_resolution(text,text,text,text,text,text,text,numeric,text,text,boolean) to authenticated;

comment on function public.save_verified_issue_resolution(text,text,text,text,text,text,text,numeric,text,text,boolean) is
  'Saves an issue follow-up and prevents Resolved status until a manager confirms the solution was tested and worked.';
