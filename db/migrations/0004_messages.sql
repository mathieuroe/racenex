-- ============================================================
--  racenex — Migration 0004: direct messages between athletes
-- ============================================================

create table messages (
  id            uuid primary key default gen_random_uuid(),
  sender_id     uuid not null references athletes(id) on delete cascade,
  recipient_id  uuid not null references athletes(id) on delete cascade,
  body          text not null,
  read_at       timestamptz,
  created_at    timestamptz not null default now(),

  constraint body_len check (char_length(body) between 1 and 5000),
  constraint no_self_message check (sender_id <> recipient_id)
);

create index idx_messages_sender on messages (sender_id, created_at);
create index idx_messages_recipient on messages (recipient_id, created_at);

comment on table messages is 'Private direct messages between athletes. Not public — RLS restricts to sender/recipient only.';

alter table messages enable row level security;

create policy "read own messages" on messages for select
  using (sender_id = my_athlete_id() or recipient_id = my_athlete_id());

create policy "send own messages" on messages for insert
  with check (sender_id = my_athlete_id());

create policy "mark received messages read" on messages for update
  using (recipient_id = my_athlete_id())
  with check (recipient_id = my_athlete_id());

grant select, insert, update on messages to authenticated;
grant all on messages to service_role;
