-- Permission-aware work-file library with explicit extraction and analysis audit.
begin;

create table if not exists public.file_library_extractions (
  source_kind text not null check (source_kind in ('activity','task','graphic')),
  source_file_id uuid not null,
  extracted_by uuid not null references public.profiles(id),
  extractor text not null default 'browser',
  segments jsonb not null default '[]'::jsonb,
  plain_text text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(source_kind,source_file_id),
  check (jsonb_typeof(segments)='array'),
  check (char_length(plain_text)<=500000)
);

create table if not exists public.file_library_analyses (
  id uuid primary key default gen_random_uuid(),
  source_kind text not null check (source_kind in ('activity','task','graphic')),
  source_file_id uuid not null,
  requested_by uuid not null references public.profiles(id),
  topic text not null check (char_length(trim(topic)) between 2 and 300),
  answer text not null check (char_length(answer)<=30000),
  citations jsonb not null default '[]'::jsonb,
  engine text not null default 'company-rules',
  created_at timestamptz not null default now(),
  check (jsonb_typeof(citations)='array')
);

create index if not exists file_library_analyses_source_idx
on public.file_library_analyses(source_kind,source_file_id,created_at desc);

create or replace function public.can_read_file_library_item(p_source_kind text,p_source_file_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select case p_source_kind
    when 'activity' then exists(
      select 1 from public.activity_files f
      where f.id=p_source_file_id and public.can_read_daily_activity(f.activity_id)
    )
    when 'task' then exists(
      select 1 from public.task_assignee_files f
      where f.id=p_source_file_id and public.can_view_assignee_workspace(f.task_id,f.user_id)
    )
    when 'graphic' then exists(
      select 1 from public.graphic_job_files f
      where f.id=p_source_file_id and public.can_edit_graphic_job(f.job_id)
    )
    else false
  end
$$;

create or replace function public.file_library_items(
  p_query text default '',p_source text default '',p_limit integer default 200,p_offset integer default 0
)
returns table(
  source_kind text,source_file_id uuid,work_id text,work_no bigint,work_title text,
  department_code text,file_name text,file_kind text,mime_type text,size_bytes bigint,
  bucket_name text,storage_path text,external_url text,created_at timestamptz,
  can_extract boolean,extraction_status text,extracted_at timestamptz
)
language sql stable security definer set search_path=public as $$
  with all_items as (
    select 'activity'::text source_kind,f.id source_file_id,d.id::text work_id,d.id work_no,
      d.activity work_title,d.department_code,f.file_name,'หลักฐานกิจกรรม'::text file_kind,
      coalesce(f.mime_type,'') mime_type,f.size_bytes,'activity-files'::text bucket_name,
      f.storage_path,''::text external_url,f.created_at,
      true can_extract
    from public.activity_files f join public.daily_activities d on d.id=f.activity_id
    where public.can_read_daily_activity(f.activity_id)
    union all
    select 'task',f.id,t.id::text,t.task_no,t.title,t.department_code,f.file_name,
      'ไฟล์งานผู้รับผิดชอบ',coalesce(f.mime_type,''),f.size_bytes,'task-assignee-files',
      f.storage_path,'',f.created_at,true
    from public.task_assignee_files f join public.tasks t on t.id=f.task_id
    where public.can_view_assignee_workspace(f.task_id,f.user_id)
    union all
    select 'graphic',f.id,j.id::text,j.job_no,j.title,j.department_code,
      coalesce(nullif(f.name,''),'ไฟล์งานกราฟิก'),
      case f.file_type when 'final' then 'ไฟล์ Final' when 'working' then 'ไฟล์ทำงาน' else 'ไฟล์อ้างอิง' end,
      coalesce(f.mime_type,''),f.size_bytes,'graphic-job-files',coalesce(f.storage_path,''),
      case when coalesce(f.storage_path,'')='' then coalesce(f.url,'') else '' end,
      f.created_at,coalesce(f.storage_path,'')<>''
    from public.graphic_job_files f join public.graphic_jobs j on j.id=f.job_id
    where public.can_edit_graphic_job(f.job_id)
  )
  select i.source_kind,i.source_file_id,i.work_id,i.work_no,i.work_title,i.department_code,
    i.file_name,i.file_kind,i.mime_type,i.size_bytes,i.bucket_name,i.storage_path,i.external_url,
    i.created_at,i.can_extract,
    case when x.source_file_id is null then 'not_extracted' else 'ready' end,
    x.updated_at
  from all_items i
  left join public.file_library_extractions x
    on x.source_kind=i.source_kind and x.source_file_id=i.source_file_id
  where (coalesce(p_source,'')='' or i.source_kind=p_source)
    and (coalesce(trim(p_query),'')='' or concat_ws(' ',i.file_name,i.work_title,i.department_code,i.file_kind) ilike '%'||trim(p_query)||'%')
  order by i.created_at desc
  limit greatest(1,least(coalesce(p_limit,200),500)) offset greatest(coalesce(p_offset,0),0)
$$;

create or replace function public.save_file_library_extraction(
  p_source_kind text,p_source_file_id uuid,p_segments jsonb
)
returns public.file_library_extractions
language plpgsql security definer set search_path=public as $$
declare result public.file_library_extractions; combined text;
begin
  if not public.can_read_file_library_item(p_source_kind,p_source_file_id) then
    raise exception using errcode='42501',message='ไม่มีสิทธิ์อ่านข้อความจากไฟล์นี้';
  end if;
  if jsonb_typeof(p_segments)<>'array' or jsonb_array_length(p_segments)>1000 or pg_column_size(p_segments)>1500000 then
    raise exception 'extracted content is too large or invalid';
  end if;
  select left(string_agg(coalesce(value->>'text',''),E'\n\n' order by ordinality),500000)
    into combined from jsonb_array_elements(p_segments) with ordinality;
  insert into public.file_library_extractions(source_kind,source_file_id,extracted_by,segments,plain_text)
  values(p_source_kind,p_source_file_id,auth.uid(),p_segments,coalesce(combined,''))
  on conflict(source_kind,source_file_id) do update set
    extracted_by=excluded.extracted_by,segments=excluded.segments,plain_text=excluded.plain_text,
    extractor='browser',updated_at=clock_timestamp()
  returning * into result;
  return result;
end
$$;

create or replace function public.get_file_library_extraction(p_source_kind text,p_source_file_id uuid)
returns public.file_library_extractions
language plpgsql stable security definer set search_path=public as $$
declare result public.file_library_extractions;
begin
  if not public.can_read_file_library_item(p_source_kind,p_source_file_id) then
    raise exception using errcode='42501',message='ไม่มีสิทธิ์อ่านข้อความจากไฟล์นี้';
  end if;
  select * into result from public.file_library_extractions
  where source_kind=p_source_kind and source_file_id=p_source_file_id;
  return result;
end
$$;

create or replace function public.save_file_library_analysis(
  p_source_kind text,p_source_file_id uuid,p_topic text,p_answer text,p_citations jsonb
)
returns uuid language plpgsql security definer set search_path=public as $$
declare result uuid;
begin
  if not public.can_read_file_library_item(p_source_kind,p_source_file_id) then
    raise exception using errcode='42501',message='ไม่มีสิทธิ์วิเคราะห์ไฟล์นี้';
  end if;
  if jsonb_typeof(p_citations)<>'array' or pg_column_size(p_citations)>200000 then raise exception 'invalid citations'; end if;
  insert into public.file_library_analyses(source_kind,source_file_id,requested_by,topic,answer,citations)
  values(p_source_kind,p_source_file_id,auth.uid(),left(trim(p_topic),300),left(p_answer,30000),p_citations)
  returning id into result;
  return result;
end
$$;

alter table public.file_library_extractions enable row level security;
alter table public.file_library_analyses enable row level security;
create policy "permitted users read file extractions" on public.file_library_extractions for select to authenticated
using (public.can_read_file_library_item(source_kind,source_file_id));
create policy "requesters read file analyses" on public.file_library_analyses for select to authenticated
using (requested_by=auth.uid() and public.can_read_file_library_item(source_kind,source_file_id));

revoke all on function public.can_read_file_library_item(text,uuid) from public;
revoke all on function public.file_library_items(text,text,integer,integer) from public;
revoke all on function public.save_file_library_extraction(text,uuid,jsonb) from public;
revoke all on function public.get_file_library_extraction(text,uuid) from public;
revoke all on function public.save_file_library_analysis(text,uuid,text,text,jsonb) from public;
grant execute on function public.can_read_file_library_item(text,uuid) to authenticated;
grant execute on function public.file_library_items(text,text,integer,integer) to authenticated;
grant execute on function public.save_file_library_extraction(text,uuid,jsonb) to authenticated;
grant execute on function public.get_file_library_extraction(text,uuid) to authenticated;
grant execute on function public.save_file_library_analysis(text,uuid,text,text,jsonb) to authenticated;
revoke insert,update,delete on public.file_library_extractions,public.file_library_analyses from authenticated;

comment on function public.file_library_items is
  'Metadata-only search. Graphic files are visible only to collaborators, creators and managers.';
comment on table public.file_library_extractions is
  'Text is stored only after an authorized user explicitly requests per-file extraction.';

commit;
