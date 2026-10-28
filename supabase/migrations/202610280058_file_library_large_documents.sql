-- Keep explicit extraction usable for larger spreadsheets and documents while
-- retaining a bounded payload and the same per-work permission check.
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
  if jsonb_typeof(p_segments)<>'array'
     or jsonb_array_length(p_segments)>3000
     or pg_column_size(p_segments)>6000000 then
    raise exception 'extracted content is too large or invalid';
  end if;
  select left(string_agg(coalesce(value->>'text',''),E'\n\n' order by ordinality),5000000)
    into combined from jsonb_array_elements(p_segments) with ordinality;
  insert into public.file_library_extractions(source_kind,source_file_id,extracted_by,segments,plain_text)
  values(p_source_kind,p_source_file_id,auth.uid(),p_segments,coalesce(combined,''))
  on conflict(source_kind,source_file_id) do update set
    extracted_by=excluded.extracted_by,segments=excluded.segments,plain_text=excluded.plain_text,
    extractor='browser',updated_at=clock_timestamp()
  returning * into result;
  return result;
end $$;

revoke all on function public.save_file_library_extraction(text,uuid,jsonb) from public;
grant execute on function public.save_file_library_extraction(text,uuid,jsonb) to authenticated;
