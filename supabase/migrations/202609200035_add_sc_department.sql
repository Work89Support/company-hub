insert into public.departments (code,name) values ('SC','SC') on conflict (code) do nothing;
select code,name from public.departments where code='SC';
