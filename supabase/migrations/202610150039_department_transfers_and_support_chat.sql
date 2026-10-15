-- Preserve department history when an employee moves, and provide one shared
-- support room for the first Company Hub chat pilot.

create table if not exists public.employee_department_history (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  department_code text not null references public.departments(code),
  position_title text not null default '',
  role public.company_role not null,
  assigned_from date not null default current_date,
  assigned_until date,
  transfer_reason text not null default '',
  changed_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  constraint employee_department_history_dates
    check (assigned_until is null or assigned_until >= assigned_from)
);

create unique index if not exists employee_department_history_one_current
  on public.employee_department_history(profile_id)
  where assigned_until is null;
create index if not exists employee_department_history_profile_dates
  on public.employee_department_history(profile_id, assigned_from desc);

alter table public.employee_department_history enable row level security;
drop policy if exists "employees read own department history" on public.employee_department_history;
drop policy if exists "access admins read department history" on public.employee_department_history;
create policy "employees read own department history"
  on public.employee_department_history for select to authenticated
  using (profile_id=auth.uid());
create policy "access admins read department history"
  on public.employee_department_history for select to authenticated
  using (public.is_access_admin());

insert into public.employee_department_history(
  profile_id, department_code, position_title, role, assigned_from, changed_by
)
select p.id, p.department_code, coalesce(p.position_title,''), p.role,
       coalesce(p.created_at::date,current_date), p.id
from public.profiles p
where p.department_code is not null
  and not exists (
    select 1 from public.employee_department_history h
    where h.profile_id=p.id and h.assigned_until is null
  );

create or replace function public.transfer_employee_department(
  p_profile_id uuid,
  p_new_department text,
  p_effective_date date,
  p_reason text,
  p_new_position_title text,
  p_keep_old_visibility boolean default false
) returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  v_profile public.profiles%rowtype;
  v_caller_role public.company_role;
  v_old_department text;
  v_previous jsonb;
begin
  if not public.is_access_admin() then
    raise exception 'insufficient permission';
  end if;
  select role into v_caller_role from public.profiles where id=auth.uid() and active;
  if p_effective_date is null then
    raise exception 'effective date is required';
  end if;
  if length(trim(coalesce(p_reason,''))) < 3 then
    raise exception 'transfer reason is required';
  end if;
  if length(trim(coalesce(p_new_position_title,''))) < 1 then
    raise exception 'position title is required';
  end if;

  select * into v_profile from public.profiles
  where id=p_profile_id and active
  for update;
  if not found then raise exception 'target user not found or inactive'; end if;
  if v_profile.role='admin' and v_caller_role<>'admin' then
    raise exception 'only admin can transfer an admin account';
  end if;

  p_new_department := upper(trim(coalesce(p_new_department,'')));
  if not exists(select 1 from public.departments where code=p_new_department and active) then
    raise exception 'invalid or inactive department';
  end if;
  v_old_department := v_profile.department_code;
  if v_old_department=p_new_department then
    raise exception 'new department must differ from current department';
  end if;
  if p_effective_date > current_date then
    raise exception 'future transfers are not supported in this pilot';
  end if;

  select jsonb_build_object(
    'role',v_profile.role,
    'primary_department',v_old_department,
    'position_title',v_profile.position_title
  ) into v_previous;

  update public.employee_department_history
  set assigned_until=p_effective_date,
      transfer_reason=trim(p_reason),
      changed_by=auth.uid()
  where profile_id=p_profile_id and assigned_until is null;

  insert into public.employee_department_history(
    profile_id, department_code, position_title, role,
    assigned_from, transfer_reason, changed_by
  ) values (
    p_profile_id, p_new_department, trim(p_new_position_title), v_profile.role,
    p_effective_date, trim(p_reason), auth.uid()
  );

  update public.profiles
  set department_code=p_new_department,
      position_title=trim(p_new_position_title),
      updated_at=now()
  where id=p_profile_id;

  if not p_keep_old_visibility then
    delete from public.profile_departments
    where profile_id=p_profile_id and department_code=v_old_department;
  end if;
  insert into public.profile_departments(profile_id,department_code,can_manage)
  values(p_profile_id,p_new_department,v_profile.role in ('lead','exec','admin'))
  on conflict(profile_id,department_code)
  do update set can_manage=excluded.can_manage;

  insert into public.access_audit(actor_id,target_user_id,old_access,new_access)
  values(
    auth.uid(),p_profile_id,v_previous,
    jsonb_build_object(
      'action','department_transfer',
      'primary_department',p_new_department,
      'position_title',trim(p_new_position_title),
      'effective_date',p_effective_date,
      'reason',trim(p_reason),
      'kept_old_visibility',p_keep_old_visibility
    )
  );
end
$$;

revoke all on function public.transfer_employee_department(uuid,text,date,text,text,boolean) from public;
grant execute on function public.transfer_employee_department(uuid,text,date,text,text,boolean) to authenticated;

create table if not exists public.support_chat_messages (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id),
  author_name text not null,
  department_code text references public.departments(code),
  message_type text not null default 'problem'
    check (message_type in ('problem','update')),
  body text not null check (char_length(trim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index if not exists support_chat_messages_created_at
  on public.support_chat_messages(created_at desc);

create or replace function public.set_support_chat_author()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare v_profile public.profiles%rowtype;
begin
  select * into v_profile from public.profiles
  where id=auth.uid() and active;
  if not found then raise exception 'active profile required'; end if;
  new.author_id := auth.uid();
  new.author_name := coalesce(nullif(trim(v_profile.display_name),''),v_profile.email);
  new.department_code := v_profile.department_code;
  new.body := trim(new.body);
  return new;
end
$$;

drop trigger if exists support_chat_author_snapshot on public.support_chat_messages;
create trigger support_chat_author_snapshot
before insert on public.support_chat_messages
for each row execute function public.set_support_chat_author();

alter table public.support_chat_messages enable row level security;
drop policy if exists "active users read shared support chat" on public.support_chat_messages;
drop policy if exists "active users send shared support chat" on public.support_chat_messages;
create policy "active users read shared support chat"
  on public.support_chat_messages for select to authenticated
  using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.active));
create policy "active users send shared support chat"
  on public.support_chat_messages for insert to authenticated
  with check (
    author_id=auth.uid()
    and exists(select 1 from public.profiles p where p.id=auth.uid() and p.active)
  );

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime'
      and schemaname='public'
      and tablename='support_chat_messages'
  ) then
    alter publication supabase_realtime add table public.support_chat_messages;
  end if;
end
$$;

grant select on public.employee_department_history to authenticated;
grant select,insert on public.support_chat_messages to authenticated;
