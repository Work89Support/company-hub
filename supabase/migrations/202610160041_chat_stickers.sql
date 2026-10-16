-- Company Hub chat stickers. Access remains governed by the room RLS policies.

alter table public.support_chat_messages
  drop constraint if exists support_chat_messages_message_type_check;

alter table public.support_chat_messages
  add constraint support_chat_messages_message_type_check
  check (message_type in ('message','problem','update','sticker'));

alter table public.support_chat_messages
  drop constraint if exists support_chat_messages_sticker_key_check;

alter table public.support_chat_messages
  add constraint support_chat_messages_sticker_key_check
  check (
    message_type <> 'sticker'
    or body in ('like','love','thanks','great','ok','done','fight','laugh','wow','idea','please','cheer')
  );
