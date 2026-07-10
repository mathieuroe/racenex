-- ============================================================
--  racenex — Migration 0001: extend events for the event importer
--
--  Adds fields needed to import public race-calendar metadata
--  (name, date, place, sport, distance) without touching results
--  or participant data. Run against the existing schema.sql base.
--
--  NOTE: the two ALTER TYPE ... ADD VALUE statements must each
--  run in their own transaction/statement (Postgres requirement).
--  In the Supabase SQL editor, run this whole file as-is — each
--  statement executes separately there. If you ever run this via
--  a single multi-statement transaction elsewhere, split the
--  ALTER TYPE lines out first and run them, then the rest.
-- ============================================================

-- sport_type gains the two disciplines the importer scope requires
alter type sport_type add value if not exists 'swimming';
alter type sport_type add value if not exists 'obstacle';

-- sub-classification within a sport (road vs. trail running, etc.)
create type event_discipline as enum ('road', 'trail', 'ultra', 'open_water');

alter table events
  add column if not exists discipline event_discipline,
  add column if not exists distance_key text,
  add column if not exists region text,
  add column if not exists lat double precision,
  add column if not exists lng double precision;

comment on column events.discipline is 'Optional sub-classification, e.g. road vs. trail running, or open water swimming.';
comment on column events.distance_key is 'Short machine-readable distance token, e.g. "70.3", "42k", "100m". Pairs with the existing distance_label for display.';
comment on column events.region is 'State/province/region name, complements city + country_code.';
comment on column events.lat is 'Geocoded latitude of the event location (city-level precision).';
comment on column events.lng is 'Geocoded longitude of the event location (city-level precision).';
