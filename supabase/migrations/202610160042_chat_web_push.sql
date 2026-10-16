-- Per-device Web Push subscriptions for Company Hub chat.
-- Notification delivery still re-checks room membership in the Edge Function.

create table if not exists public.chat_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique check (char_length(endpoint) between 20 and 2048),
  p256dh text not null check (char_length(p256dh) between 20 and 512),
  auth text not null check (char_length(auth) between 8 and 256),
  user_agent text,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists chat_push_subscriptions_profile_idx
  on public.chat_push_subscriptions(profile_id) where enabled;

create or replace function public.set_chat_push_subscription_owner()
returns trigger language plpgsql security definer set search_path=public
as $$
begin
  if not public.is_active_company_user() then raise exception 'active profile required'; end if;
  new.profile_id := auth.uid();
  new.endpoint := trim(new.endpoint);
  new.p256dh := trim(new.p256dh);
  new.auth := trim(new.auth);
  new.user_agent := left(coalesce(new.user_agent,''),500);
  new.updated_at := now();
  return new;
end
$$;

drop trigger if exists set_chat_push_subscription_owner on public.chat_push_subscriptions;
create trigger set_chat_push_subscription_owner
before insert or update on public.chat_push_subscriptions
for each row execute function public.set_chat_push_subscription_owner();

alter table public.chat_push_subscriptions enable row level security;
drop policy if exists "users read own push subscriptions" on public.chat_push_subscriptions;
drop policy if exists "users register own push subscriptions" on public.chat_push_subscriptions;
drop policy if exists "users update own push subscriptions" on public.chat_push_subscriptions;
drop policy if exists "users delete own push subscriptions" on public.chat_push_subscriptions;
create policy "users read own push subscriptions" on public.chat_push_subscriptions
  for select to authenticated using (profile_id=auth.uid());
create policy "users register own push subscriptions" on public.chat_push_subscriptions
  for insert to authenticated with check (profile_id=auth.uid());
create policy "users update own push subscriptions" on public.chat_push_subscriptions
  for update to authenticated using (profile_id=auth.uid()) with check (profile_id=auth.uid());
create policy "users delete own push subscriptions" on public.chat_push_subscriptions
  for delete to authenticated using (profile_id=auth.uid());

grant select,insert,update,delete on public.chat_push_subscriptions to authenticated;
