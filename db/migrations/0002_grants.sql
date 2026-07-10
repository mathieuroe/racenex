-- ============================================================
--  racenex — Migration 0002: Data API role grants
--
--  The Supabase project was created with "Automatically expose new
--  tables" disabled (deliberate: explicit control instead of
--  default-open tables). RLS policies alone don't grant table-level
--  access — Postgres still requires an explicit GRANT for the
--  anon/authenticated roles, or every query fails with
--  "permission denied for table ...". This migration adds that.
-- ============================================================

grant usage on schema public to anon, authenticated;

grant select on athletes, events, event_stats, participations, results, posts
  to anon, authenticated;

grant insert, update on athletes to authenticated;
grant insert, update, delete on participations to authenticated;
grant insert, update, delete on results to authenticated;
grant insert, update, delete on posts to authenticated;
