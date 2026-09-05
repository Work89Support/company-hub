begin;
-- Immutable evidence snapshots remain even if links on source work change later.
create table public.kpi_result_audit (
 id bigint generated always as identity primary key,
 result_id uuid not null references public.kpi_results(id),
 actor_id uuid not null references public.profiles(id),
 before_row jsonb, after_row jsonb not null,
 created_at timestamptz not null default now()
);
alter table public.kpi_result_audit enable row level security;
create policy kpi_audit_read on public.kpi_result_audit for select to authenticated using(exists(select 1 from kpi_results r where r.id=result_id));
grant select on public.kpi_result_audit to authenticated;
create function public.save_monthly_kpi_result(p_definition uuid,p_period_start date,p_actual numeric,p_note text,p_status text,p_expected_version integer)
returns public.kpi_results language plpgsql security definer set search_path=public as $$
declare d public.kpi_definitions;r public.kpi_results;out_row public.kpi_results;ending date;snapshot jsonb;
begin
 if not public.my_company_credentials_ready() then raise exception 'บัญชียังไม่พร้อม';end if;
 select * into d from kpi_definitions where id=p_definition;
 if d.id is null or not d.active or not can_manage_department(d.department_code) then raise exception 'ไม่มีสิทธิ์รับรอง KPI ของแผนกนี้';end if;
 if p_period_start is null or extract(day from p_period_start)<>1 or p_period_start>(now() at time zone 'Asia/Bangkok')::date then raise exception 'รอบเดือนไม่ถูกต้อง';end if;
 if p_actual is null or p_actual<0 or p_actual::text in ('NaN','Infinity','-Infinity') or length(trim(coalesce(p_note,'')))<3 or length(p_note)>10000 or p_status is null or p_status not in ('draft','review','approved','locked') or p_expected_version is null then raise exception 'กรุณากรอกผลและหลักฐานให้ครบ';end if;
 if d.prototype_payload->>'unit'='ratio' and p_actual>1 then raise exception 'สัดส่วนต้องอยู่ระหว่าง 0 และ 1';end if;
 ending:=(p_period_start+interval '1 month - 1 day')::date;
 if p_status in ('approved','locked') and ending>=(now() at time zone 'Asia/Bangkok')::date then raise exception 'รับรองได้หลังสิ้นสุดรอบเดือน';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_definition::text||p_period_start::text,0));
 select * into r from kpi_results where definition_id=p_definition and period_start=p_period_start and period_end=ending for update;
 if coalesce(r.version,0)<>p_expected_version then raise exception 'ผลถูกแก้ไขแล้ว กรุณาเปิดใหม่';end if;
 if r.status='locked' then raise exception 'รอบนี้ล็อกแล้ว';end if;
 if p_status='locked' and r.status is distinct from 'approved' then raise exception 'ต้องรับรองก่อนล็อกรอบ';end if;
 if r.status='approved' and (p_status not in ('approved','locked') or r.actual<>p_actual or r.evidence->>'note' is distinct from p_note) then raise exception 'ผลรับรองแล้ว แก้ตัวเลขหรือหลักฐานไม่ได้';end if;
 select coalesce(jsonb_agg(to_jsonb(l)),'[]') into snapshot from kpi_work_links l where l.definition_id=p_definition;
 insert into kpi_results(definition_id,period_start,period_end,actual,evidence,status,entered_by,approved_by,approved_at)
 values(p_definition,p_period_start,ending,p_actual,jsonb_build_object('note',p_note,'linked_work_snapshot',snapshot),p_status,auth.uid(),case when p_status='approved' then auth.uid() end,case when p_status='approved' then now() end)
 on conflict(definition_id,period_start,period_end) do update set actual=excluded.actual,
 evidence=case when kpi_results.status='approved' then kpi_results.evidence else excluded.evidence end,
 status=excluded.status,version=kpi_results.version+1,
 approved_by=case when excluded.status='approved' then auth.uid() else kpi_results.approved_by end,
 approved_at=case when excluded.status='approved' then now() else kpi_results.approved_at end
 returning * into out_row;
 insert into kpi_result_audit(result_id,actor_id,before_row,after_row) values(out_row.id,auth.uid(),case when r.id is null then null else to_jsonb(r) end,to_jsonb(out_row));return out_row;
end $$;
revoke all on function public.save_monthly_kpi_result(uuid,date,numeric,text,text,integer) from public;
grant execute on function public.save_monthly_kpi_result(uuid,date,numeric,text,text,integer) to authenticated;
-- Enforce the approval workflow for API clients too, not only the form.
revoke insert,update,delete on public.kpi_results from authenticated;
commit;
