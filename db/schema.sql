-- ============================================================
--  racenex — Datenbank-Schema (Postgres / Supabase)
--  Version 0.1 — MVP
--
--  Drei Datenebenen:
--    1) event_stats  = anonyme Aggregate  (SEO-Motor, DSGVO-unkritisch)
--    2) results      = nutzereigene Daten (Lock-in, mit Zustimmung)
--    3) participations/posts = Community   (Daily Hook)
-- ============================================================

-- ---------- ENUMS ----------
create type sport_type as enum ('triathlon', 'running', 'hyrox', 'cycling', 'swimrun', 'other');
create type participation_status as enum ('interested', 'registered', 'finished', 'dnf', 'dns');
create type result_source as enum ('claimed', 'assisted_import', 'verified');

-- ============================================================
--  ATHLETES  — das Profil
-- ============================================================
create table athletes (
  id            uuid primary key default gen_random_uuid(),
  -- Verknüpfung zu Supabase Auth (auth.users). Nullable, damit man Profile
  -- auch anlegen kann bevor/ohne dass ein Login existiert (z.B. Seed).
  auth_user_id  uuid unique references auth.users(id) on delete set null,
  handle        text unique not null,            -- öffentliche URL: racenex.com/@handle
  display_name  text not null,
  home_city     text,
  country_code  char(2),                          -- ISO, z.B. 'DE'
  age_group     text,                             -- 'AK35-39' etc. (kein Geburtsdatum → Datensparsamkeit)
  avatar_url    text,
  bio           text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint handle_format check (handle ~ '^[a-z0-9_]{3,30}$')
);

comment on table athletes is 'Öffentliches Athletenprofil. age_group statt Geburtsdatum aus Datensparsamkeit.';

-- ============================================================
--  EVENTS  — der Kern. Steuert das Zwei-Schichten-Modell.
-- ============================================================
create table events (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,             -- SEO-URL: /event/ironman-703-venice-2027
  name          text not null,
  sport_type    sport_type not null,
  event_date    date,
  city          text,
  country_code  char(2),
  distance_label text,                            -- '70.3', 'Marathon', 'Hyrox Pro' ...

  -- ZWEI-SCHICHTEN-MODELL:
  --   false = automatisch importierte SEO-Seite (Schicht 1)
  --   true  = von dir gezündeter Community-Raum  (Schicht 2)
  is_activated  boolean not null default false,

  -- Aktivierungs-Trigger: ab wie vielen "dabei" schaltet der Raum frei
  activation_threshold int not null default 20,

  cover_image_url text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on column events.is_activated is 'true = Community-Raum offen (Schicht 2). false = nur Stats-Seite (Schicht 1).';

create index idx_events_date on events (event_date);
create index idx_events_sport on events (sport_type);
create index idx_events_activated on events (is_activated) where is_activated = true;

-- ============================================================
--  EVENT_STATS  — Ebene 1: anonyme Aggregate pro Event & Jahr
--  KEINE Personendaten. Speist Histogramm, Splits, AK-Verteilung.
-- ============================================================
create table event_stats (
  id             uuid primary key default gen_random_uuid(),
  event_id       uuid not null references events(id) on delete cascade,
  year           int not null,
  finisher_count int not null default 0,

  -- Finish-Zeiten in Sekunden (leichter zu rechnen; UI formatiert h:mm:ss)
  avg_finish_sec    int,
  median_finish_sec int,
  best_finish_sec   int,

  -- Histogramm-Buckets: [{"from_sec":14400,"to_sec":15000,"count":210}, ...]
  distribution   jsonb not null default '[]',

  -- Disziplin-Splits Ø Feld vs Top10%:
  --   {"swim":{"avg_sec":2460,"top10_sec":1920,"note":"mit Strömung"}, "bike":{...}, "run":{...}}
  splits         jsonb,

  -- Altersgruppen-Verteilung:
  --   [{"ag":"AK35-39","count":312,"median_sec":19800}, ...]
  ag_distribution jsonb not null default '[]',

  source_note    text,                            -- Herkunft der Aggregate (Nachvollziehbarkeit)
  created_at     timestamptz not null default now(),

  unique (event_id, year)
);

comment on table event_stats is 'Ebene 1: anonyme Aggregate. Keine personenbezogenen Daten → DSGVO-unkritisch. Speist die öffentlichen Stats-Seiten.';

create index idx_stats_event on event_stats (event_id);

-- ============================================================
--  PARTICIPATIONS  — "ich bin dabei". Speist den Aktivierungs-Trigger.
-- ============================================================
create table participations (
  id           uuid primary key default gen_random_uuid(),
  athlete_id   uuid not null references athletes(id) on delete cascade,
  event_id     uuid not null references events(id) on delete cascade,
  goal_text    text,                              -- "sub 5:15"
  status       participation_status not null default 'interested',
  created_at   timestamptz not null default now(),

  unique (athlete_id, event_id)
);

create index idx_part_event on participations (event_id);
create index idx_part_athlete on participations (athlete_id);

-- ============================================================
--  RESULTS  — Ebene 2: nutzereigene Ergebnisse. Der Lock-in.
--  official_url = Echtheitsbeweis (statt Scraping).
-- ============================================================
create table results (
  id            uuid primary key default gen_random_uuid(),
  athlete_id    uuid not null references athletes(id) on delete cascade,
  event_id      uuid references events(id) on delete set null,
  -- Falls das Event (noch) nicht in der DB ist, Freitext-Fallback:
  event_label   text,
  event_date    date,
  sport_type    sport_type,

  finish_time_sec int,
  splits        jsonb,                             -- {"swim_sec":..,"bike_sec":..,"run_sec":..}
  age_group     text,
  overall_rank  int,
  ag_rank       int,

  official_url  text,                              -- Link zur offiziellen Ergebnisseite = Echtheit
  source        result_source not null default 'claimed',
  verified      boolean not null default false,

  created_at    timestamptz not null default now()
);

comment on column results.official_url is 'Link zur offiziellen Ergebnisliste. Echtheit durch Verlinkung statt durch Scraping.';

create index idx_results_athlete on results (athlete_id);
create index idx_results_event on results (event_id);

-- ============================================================
--  POSTS / REPLIES  — Ebene 3: der Austausch pro Event-Raum
--  Ein Tabelle, self-referencing (parent_id null = Post, sonst Reply).
-- ============================================================
create table posts (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references events(id) on delete cascade,
  athlete_id    uuid not null references athletes(id) on delete cascade,
  parent_id     uuid references posts(id) on delete cascade,   -- null = Top-Level-Frage
  body          text not null,
  is_pinned     boolean not null default false,
  helpful_count int not null default 0,
  created_at    timestamptz not null default now(),

  constraint body_len check (char_length(body) between 1 and 5000)
);

create index idx_posts_event on posts (event_id) where parent_id is null;
create index idx_posts_parent on posts (parent_id);

-- ============================================================
--  updated_at Trigger
-- ============================================================
create or replace function touch_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

create trigger t_athletes_touch before update on athletes
  for each row execute function touch_updated_at();
create trigger t_events_touch before update on events
  for each row execute function touch_updated_at();

-- ============================================================
--  ROW LEVEL SECURITY (Grundgerüst)
--  Öffentlich lesbar: athletes, events, event_stats, participations, posts, results
--  Schreiben: nur eigene Zeilen (via auth_user_id)
-- ============================================================
alter table athletes       enable row level security;
alter table events         enable row level security;
alter table event_stats    enable row level security;
alter table participations enable row level security;
alter table results        enable row level security;
alter table posts          enable row level security;

-- Lesen: alles öffentlich (racenex-Profile & Event-Seiten sind public)
create policy "public read athletes"       on athletes       for select using (true);
create policy "public read events"         on events         for select using (true);
create policy "public read event_stats"    on event_stats    for select using (true);
create policy "public read participations" on participations for select using (true);
create policy "public read results"        on results        for select using (true);
create policy "public read posts"          on posts          for select using (true);

-- Schreiben athletes: nur das eigene Profil
create policy "insert own athlete" on athletes for insert
  with check (auth.uid() = auth_user_id);
create policy "update own athlete" on athletes for update
  using (auth.uid() = auth_user_id);

-- Helper: eigene athlete_id ermitteln
create or replace function my_athlete_id() returns uuid as $$
  select id from athletes where auth_user_id = auth.uid() limit 1;
$$ language sql stable;

-- Schreiben participations / results / posts: nur für das eigene Athletenprofil
create policy "write own participations" on participations for all
  using (athlete_id = my_athlete_id()) with check (athlete_id = my_athlete_id());
create policy "write own results" on results for all
  using (athlete_id = my_athlete_id()) with check (athlete_id = my_athlete_id());
create policy "write own posts" on posts for all
  using (athlete_id = my_athlete_id()) with check (athlete_id = my_athlete_id());

-- events & event_stats: schreibt nur der Admin (Service-Role umgeht RLS ohnehin).
-- Keine public-write-Policy = niemand außer Service-Role kann schreiben.
