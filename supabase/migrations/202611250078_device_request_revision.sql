begin;

alter table public.user_access_devices
  drop constraint user_access_devices_status_check,
  add constraint user_access_devices_status_check
    check (status in ('pending', 'approved', 'blocked', 'rejected', 'revision_requested'));

commit;
