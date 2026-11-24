-- Add P (Programmer) as the third named device approver.
begin;

insert into public.device_access_approvers(profile_id,note)
select p.id,'คุณพี โปรแกรมเมอร์'
from public.profiles p
where p.active
  and p.id='a0ce29ce-ab88-4fb1-b8f6-28a3cb9ec587'::uuid
on conflict(profile_id) do update set note=excluded.note;

do $$
begin
  if (select count(*) from public.device_access_approvers) <> 3 then
    raise exception 'device approvers must resolve exactly to AMM, Max and P';
  end if;
end
$$;

update public.user_access_policies policy
set enforce_device=false,enforce_ip=false,session_minutes=30,updated_at=now()
where policy.profile_id='a0ce29ce-ab88-4fb1-b8f6-28a3cb9ec587'::uuid;

comment on table public.device_access_approvers is
  'Named device reviewers: AMM, Max and P. This is deliberately separate from role=admin so other Programmer admins cannot approve device access.';

commit;
