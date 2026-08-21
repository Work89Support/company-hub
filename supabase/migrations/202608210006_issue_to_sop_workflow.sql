-- Complete the operational issue loop: root-cause/CAPA fields and controlled SOP drafts.

alter table public.operational_issues
  add column if not exists root_cause text not null default '' check (char_length(root_cause) <= 500),
  add column if not exists preventive_action text not null default '' check (char_length(preventive_action) <= 4000);

alter table public.sops
  add column if not exists source_issue_id text references public.operational_issues(id) on delete set null;

create index if not exists sops_source_issue_id_idx on public.sops(source_issue_id);

create or replace function public.save_issue_sop_draft(
  target_issue text,
  draft_payload jsonb,
  submit_review boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  caller public.profiles%rowtype;
  issue public.operational_issues%rowtype;
  sop_row public.sops%rowtype;
  safe_payload jsonb;
  record_key text;
  next_version integer;
  next_status text;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select * into caller from public.profiles where id=auth.uid() and active;
  if caller.id is null then raise exception 'active profile required'; end if;
  if not (caller.role in ('exec','admin') or public.can_manage_department('ADMIN')) then
    raise exception 'ADMIN management permission required';
  end if;
  select * into issue from public.operational_issues where id=target_issue and department_code='ADMIN';
  if issue.id is null then raise exception 'operational issue not found'; end if;
  if jsonb_typeof(draft_payload)<>'object' or pg_column_size(draft_payload)>65536 then
    raise exception 'invalid SOP draft payload';
  end if;
  if char_length(trim(coalesce(draft_payload->>'title','')))<1 then raise exception 'SOP title required'; end if;
  if jsonb_typeof(draft_payload->'steps')<>'array' or jsonb_array_length(draft_payload->'steps')<2 then
    raise exception 'at least two SOP steps required';
  end if;

  record_key:=left('SOP-ISSUE-'||target_issue,80);
  next_status:=case when submit_review then 'review' else 'draft' end;
  safe_payload:=draft_payload || jsonb_build_object(
    'id',record_key,'dept','ADMIN','sourceIssue',target_issue,'status',next_status,
    'v',case when submit_review then 'รอตรวจ 0.1' else 'ร่าง 0.1' end
  );

  select * into sop_row from public.sops where source_issue_id=target_issue or legacy_key=record_key order by created_at limit 1;
  if sop_row.id is null then
    insert into public.sops(department_code,title,status,created_by,legacy_key,prototype_payload,source_issue_id)
    values('ADMIN',left(safe_payload->>'title',300),next_status,caller.id,record_key,safe_payload,target_issue)
    returning * into sop_row;
  else
    update public.sops set title=left(safe_payload->>'title',300),status=next_status,
      prototype_payload=safe_payload,source_issue_id=target_issue
    where id=sop_row.id returning * into sop_row;
  end if;

  select coalesce(max(version),0)+1 into next_version from public.sop_versions where sop_id=sop_row.id;
  insert into public.sop_versions(sop_id,version,content)
  values(sop_row.id,next_version,safe_payload);

  return jsonb_build_object('sop_id',sop_row.id,'status',next_status,'version',next_version,'payload',safe_payload);
end
$$;

revoke all on function public.save_issue_sop_draft(text,jsonb,boolean) from public;
grant execute on function public.save_issue_sop_draft(text,jsonb,boolean) to authenticated;

comment on function public.save_issue_sop_draft(text,jsonb,boolean) is
  'Creates or updates a controlled ADMIN SOP draft from an operational issue; requires ADMIN management permission.';
