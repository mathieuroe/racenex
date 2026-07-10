# racenex — Projekt-Briefing für Claude Code

> Dieses Dokument ist der Kontext-Übergabepunkt aus der Planungsphase.
> Lies es zuerst, dann kann es losgehen.

## Was racenex ist

Eine Plattform für **Ausdauersportler** (Triathlon, Hyrox, Marathon, Laufen) mit drei
ineinandergreifenden Bausteinen:

1. **Sportartübergreifende Athletenprofile** — alle Rennen einer Person an *einem* Ort
   (Ironman + Hyrox + Halbmarathon nebeneinander), statt über fünf getrennte
   Ergebnisportale verstreut.
2. **Event-Räume** — jedes Rennen hat seinen Ort: Kurs-Statistiken der Vorjahre,
   Teilnehmerliste, und ein Q&A/Austausch mit den Leuten, die dieses Jahr am Start stehen.
3. **Community mit "Leistungs-Gesicht"** — wer im Austausch antwortet, dessen Ergebnisse
   stehen daneben. Kein anonymes Forum.

**Markenname:** immer klein schreiben → `racenex` (nie "Racenex"), auch am Satzanfang.
**Domain:** racenex.com (Landing Page läuft bereits auf Vercel, sammelt E-Mails via Formspree).

## Tech-Stack (Zielbild)

- **Next.js** (App Router) + **TypeScript**
- **Supabase** (Postgres + Auth + Row Level Security)
- **Tailwind CSS**
- Deployment auf **Vercel**
- PWA-fähig (mobiloptimiert, "zum Homescreen")

## Design-Tokens (aus der fertigen Landing Page)

| Token          | Wert       | Verwendung                        |
|----------------|------------|-----------------------------------|
| Paper/BG       | `#F4F6F8`  | heller Papierweiß-Hintergrund     |
| Ink            | `#0C1116`  | near-black Text                   |
| Muted          | `#5A6572`  | gedämpfter Text                   |
| Line           | `#E2E7EC`  | Hairlines / Rahmen                |
| Signal/Akzent  | `#1B3A8F`  | Kobalt — Buttons, Marker, Focus   |
| Signal-dim     | `#132C6E`  | Hover/dunkler                     |

- **Font:** "Barlow Semi Condensed" (italic + condensed für Display/Headlines),
  "Inter" für Fließtext.
- **Markenzeichen:** der Doppel-Slash `∥` — als Trenner im Logo (race∥nex), als
  Marker vor Features/Listen, als wiederkehrendes Signature-Element.
- **Ton:** Performance-Instrument (Garmin/Whoop-Register), nicht verspielt.
  Hell, präzise, "engineered". KEIN Strava-Orange (bewusst Kobalt statt Orange).

Logo-Assets liegen bei: `racenex-wordmark-dark.png` (helle Schrift für dunklen BG),
`racenex-wordmark-light.png` (dunkle Schrift für hellen BG — für die App das richtige),
`racenex-monochrome.png`, `racenex-app-icon.png`.

## Datenmodell — drei Ebenen (WICHTIG)

Das Schema (`racenex-schema.sql`) ist in echter Postgres getestet und trennt bewusst
drei Datenebenen, damit rechtlich heikle Fremddaten nie ins Spiel kommen:

- **Ebene 1 — `event_stats`**: anonyme Aggregate pro Event (Histogramm, Splits,
  AK-Verteilung). KEINE Personendaten → DSGVO-unkritisch. Speist die öffentlichen
  Stats-Seiten (SEO-Motor). Startet mit synthetischen Daten (`racenex-seed.sql`),
  wird später pro Event durch echte, manuell erhobene Aggregate ersetzt.
- **Ebene 2 — `results`**: nutzereigene Ergebnisse, MIT Zustimmung, verlinkt zur
  offiziellen Ergebnisseite (`official_url` = Echtheit statt Scraping). Der Lock-in.
- **Ebene 3 — `participations` + `posts`**: Community. Wer ist dabei, wer fragt was.

**Kein Scraping von Fremddaten.** Ergebnisse kommen via "Claim & Link" (Nutzer trägt
sein eigenes Ergebnis ein + verlinkt Quelle) oder später "Assisted Import" (Nutzer sucht
sein eigenes Ergebnis, bestätigt es).

### Zwei-Schichten-Modell für Events
- `events.is_activated = false` → nur automatische SEO-/Stats-Seite (Schicht 1, viele)
- `events.is_activated = true` → voller Community-Raum offen (Schicht 2, kuratiert, wenige)
- `events.activation_threshold` → ab wie vielen "Ich bin dabei" ein Raum freischaltet.

## Dateien in diesem Paket

- `racenex-schema.sql`   — komplettes DB-Schema (6 Tabellen, Enums, Indizes, RLS). Getestet.
- `racenex-seed.sql`     — synthetische event_stats für 3 Beispiel-Events. Zum Bauen/Testen.
- `racenex-seed.json`    — dieselben Daten als JSON (Frontend-Mock ohne DB).
- `generate_synthetic_stats.py` — Generator, falls mehr/andere Testdaten gebraucht werden.
- `racenex-wordmark-*.png`, `racenex-app-icon.png`, `racenex-monochrome.png` — Logo-Assets.
- (Die Landing Page `index.html` liegt bereits im Projektordner.)

## Bau-Reihenfolge (Empfehlung)

1. **Setup** — Next.js + TypeScript + Tailwind aufsetzen, Supabase-Client anbinden,
   `.env` mit Supabase-Keys. Schema + Seed in Supabase einspielen.
2. **Event-Seite (dynamisch)** — liest `event_stats` aus der DB und rendert:
   Zeitverteilung als Histogramm, Disziplin-Splits, AK-Verteilung. Im Stil der
   Landing Page (Papierweiß + Kobalt + Doppel-Slash). Das erste sichtbare Ergebnis.
3. **Auth** — Supabase Auth (Login/Signup), Anlegen des `athletes`-Profils.
4. **"Ich bin dabei" + Teilnehmerliste** — `participations`, plus Athletenprofil-Seite
   mit Ergebnis-Historie (`results`), sportartübergreifend.
5. **Community-Feed** — `posts`/replies pro Event-Raum (nur wenn `is_activated`).

## Wichtige Prinzipien

- **Schritt für Schritt, früh deployen.** Nach jedem Baustein auf Vercel testen.
- **Markenname immer klein:** `racenex`.
- **Datensparsamkeit:** age_group statt Geburtsdatum, keine Adressdaten sammeln.
- **Seed-Daten sind SYNTHETISCH** — vor echtem Launch pro aktiviertem Event durch
  echte, manuell erhobene Aggregate ersetzen (der DSGVO-saubere Weg).
