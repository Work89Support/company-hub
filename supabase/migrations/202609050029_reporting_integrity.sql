begin;
create function public.report_department_visible(dept text)
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from profiles p where p.id=auth.uid() and p.active and
 (p.role in ('admin','exec') or exists(select 1 from profile_departments d where d.profile_id=p.id and d.department_code=dept)))
 and exists(select 1 from departments where code=dept)
$$;
revoke all on function public.report_department_visible(text) from public;
grant execute on function public.report_department_visible(text) to authenticated;

create table public.report_drafts (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references public.profiles(id),
 period_start date not null check (extract(day from period_start)=1),
 scope_key text not null,
 department_codes text[] not null,
 body jsonb not null default '{}'::jsonb check(jsonb_typeof(body)='object'),
 version integer not null default 1,
 updated_at timestamptz not null default now(),
 unique(owner_id,period_start,scope_key)
);
alter table public.report_drafts enable row level security;
create policy report_draft_read on public.report_drafts for select to authenticated using(
 owner_id=auth.uid() and exists(select 1 from public.profiles where id=auth.uid() and active)
 and not exists(select 1 from unnest(department_codes) d where not public.report_department_visible(d))
);
grant select on public.report_drafts to authenticated;
-- Mutations are available only through version-checked RPC. No public/direct write grants.
create function public.save_report_draft(p_period_start date,p_departments text[],p_expected_version integer,p_body jsonb)
returns public.report_drafts language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid();deps text[];scope text;current_row public.report_drafts;out_row public.report_drafts;
begin
 if not public.my_company_credentials_ready() then raise exception 'กรุณาตั้งบัญชีให้พร้อมก่อนบันทึก';end if;
 if not exists(select 1 from profiles where id=uid and active) then raise exception 'ไม่ได้รับอนุญาต';end if;
 if p_period_start is null or extract(day from p_period_start)<>1 or p_expected_version is null or p_expected_version<0 then raise exception 'รอบรายงานไม่ถูกต้อง';end if;
 select array_agg(distinct x order by x) into deps from unnest(p_departments) x;
 if coalesce(cardinality(deps),0)=0 or cardinality(deps)>50 or exists(select 1 from unnest(deps) d where d is null or not report_department_visible(d)) then raise exception 'ไม่มีสิทธิ์ในแผนกที่เลือก';end if;
 if p_body is null or jsonb_typeof(p_body)<>'object' or octet_length(p_body::text)>100000 then raise exception 'เนื้อหารายงานไม่ถูกต้อง';end if;
 if exists(select 1 from jsonb_each(p_body) e where e.key not in ('highlight','urgent','decision','supportOther','supportExec','resolution','post','note') or jsonb_typeof(e.value)<>'string' or length(e.value#>>'{}')>10000) then raise exception 'ช่องรายงานไม่ถูกต้อง';end if;
 scope:=array_to_string(deps,',');perform pg_advisory_xact_lock(hashtextextended(uid::text||p_period_start::text||scope,0));
 select * into current_row from report_drafts where owner_id=uid and period_start=p_period_start and scope_key=scope for update;
 if coalesce(current_row.version,0)<>p_expected_version then raise exception 'ร่างถูกแก้ไขจากอีกหน้าต่างแล้ว กรุณาคัดลอกข้อความและเปิดใหม่';end if;
 insert into report_drafts(owner_id,period_start,scope_key,department_codes,body) values(uid,p_period_start,scope,deps,p_body)
 on conflict(owner_id,period_start,scope_key) do update set body=excluded.body,version=report_drafts.version+1,updated_at=clock_timestamp()
 returning * into out_row;return out_row;
end $$;
revoke all on function public.save_report_draft(date,text[],integer,jsonb) from public;
grant execute on function public.save_report_draft(date,text[],integer,jsonb) to authenticated;

alter table public.operational_issues add column if not exists owner_profile_id uuid references public.profiles(id);
create function public.assign_issue_account(p_id text,p_owner uuid,p_expected_updated_at timestamptz)
returns public.operational_issues language plpgsql security definer set search_path=public as $$
declare r public.operational_issues;
begin
 if not public.my_company_credentials_ready() then raise exception 'กรุณาตั้งบัญชีให้พร้อม';end if;
 select * into r from operational_issues where id=p_id for update;
 if r.id is null or not can_manage_department(r.department_code) then raise exception 'ไม่มีสิทธิ์มอบหมาย';end if;
 if r.updated_at is distinct from p_expected_updated_at then raise exception 'รายการถูกแก้ไขแล้ว กรุณาเปิดใหม่';end if;
 if not exists(select 1 from profiles where id=p_owner and active and department_code=r.department_code) then raise exception 'กรุณาเลือกบัญชีที่เปิดใช้งานในแผนก';end if;
 update operational_issues set owner_profile_id=p_owner,updated_at=clock_timestamp() where id=p_id returning * into r;return r;
end $$;
revoke all on function public.assign_issue_account(text,uuid,timestamptz) from public;
grant execute on function public.assign_issue_account(text,uuid,timestamptz) to authenticated;

create function public.assign_graphic_account(p_id uuid,p_owner uuid,p_expected_updated_at timestamptz)
returns public.graphic_jobs language plpgsql security definer set search_path=public as $$
declare r public.graphic_jobs;owner_name text;
begin
 if not public.my_company_credentials_ready() then raise exception 'กรุณาตั้งบัญชีให้พร้อม';end if;
 select * into r from graphic_jobs where id=p_id for update;
 if r.id is null or not can_manage_department(r.department_code) then raise exception 'ไม่มีสิทธิ์มอบหมาย';end if;
 if r.updated_at is distinct from p_expected_updated_at then raise exception 'รายการถูกแก้ไขแล้ว กรุณาเปิดใหม่';end if;
 select display_name into owner_name from profiles where id=p_owner and active and department_code=r.department_code;
 if owner_name is null then raise exception 'กรุณาเลือกบัญชีที่เปิดใช้งานในแผนก';end if;
 update graphic_jobs set assignee_id=p_owner,assignee_name=owner_name,updated_at=clock_timestamp() where id=p_id returning * into r;return r;
end $$;
revoke all on function public.assign_graphic_account(uuid,uuid,timestamptz) from public;
grant execute on function public.assign_graphic_account(uuid,uuid,timestamptz) to authenticated;
commit;
