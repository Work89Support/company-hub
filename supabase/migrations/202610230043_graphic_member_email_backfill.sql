-- Keep the Trello member directory aligned with the confirmed Company Hub
-- account email after a profile link has been established. This never guesses
-- a profile from a display name and only copies an existing active account email.
update public.graphic_trello_members m
set email = lower(a.contact_email)
from public.company_login_accounts a
join public.profiles p on p.id = a.profile_id and p.active
where m.linked_profile_id = a.profile_id
  and a.contact_email is not null
  and btrim(a.contact_email) <> ''
  and lower(coalesce(m.email, '')) is distinct from lower(a.contact_email);
