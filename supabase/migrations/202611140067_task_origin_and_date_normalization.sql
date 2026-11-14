-- Preserve the true origin of native task assignments and repair legacy dates
-- that were entered with Buddhist years in a Gregorian date input.
update public.tasks
set prototype_payload=jsonb_set(coalesce(prototype_payload,'{}'::jsonb),'{source_system}','"company_hub"'::jsonb,true)
where legacy_key is null
  and coalesce(prototype_payload->>'source_system','')=''
  and coalesce(prototype_payload->>'source','')='';

update public.tasks
set due_at=make_timestamptz(
  extract(year from due_at)::integer-543,
  extract(month from due_at)::integer,
  extract(day from due_at)::integer,
  23,59,59,'Asia/Bangkok')
where extract(year from due_at) between 2400 and 2700;

update public.tasks
set start_at=make_timestamptz(
  extract(year from created_at at time zone 'Asia/Bangkok')::integer,
  extract(month from start_at)::integer,
  extract(day from start_at)::integer,
  0,0,0,'Asia/Bangkok')
where extract(year from start_at) between 1 and 99;

update public.tasks
set start_at=make_timestamptz(
  extract(year from start_at)::integer-543,
  extract(month from start_at)::integer,
  extract(day from start_at)::integer,
  0,0,0,'Asia/Bangkok')
where extract(year from start_at) between 2400 and 2700;
