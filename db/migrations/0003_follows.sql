-- ============================================================
--  racenex — Migration 0003: follow graph between athletes
--  Powers "Folgen" on profiles and, later, "Leute aus deinem
--  Netzwerk" on race results.
-- ============================================================

create table follows (
  follower_id  uuid not null references athletes(id) on delete cascade,
  followed_id  uuid not null references athletes(id) on delete cascade,
  created_at   timestamptz not null default now(),

  primary key (follower_id, followed_id),
  constraint no_self_follow check (follower_id <> followed_id)
);

create index idx_follows_followed on follows (followed_id);
create index idx_follows_follower on follows (follower_id);

comment on table follows is 'Wer folgt wem. follower_id -> followed_id, beide athletes.id.';

alter table follows enable row level security;

create policy "public read follows" on follows for select using (true);

create policy "insert own follows" on follows for insert
  with check (follower_id = my_athlete_id());
create policy "delete own follows" on follows for delete
  using (follower_id = my_athlete_id());

grant select on follows to anon, authenticated;
grant insert, delete on follows to authenticated;
grant all on follows to service_role;
