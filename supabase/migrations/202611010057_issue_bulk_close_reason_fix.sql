-- Fix PostgreSQL ambiguity between the close_reason function argument and
-- operational_issues.close_reason during an audited bulk close.
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
