#!/usr/bin/env python3
"""
racenex event importer — AIMS road marathon/half-marathon calendar (DACH)

Source: https://aims-worldrunning.org/events.ics (Association of
International Marathons and Distance Races — the official calendar of
AIMS member races, published as an iCalendar feed meant for calendar-app
subscription).

Why AIMS and not marathon.de/marathon4you.de/etc: those sites' Impressum
explicitly reserves all rights and forbids copying their event data in
any form without written permission. AIMS' events.ics has no such
restriction and is a public syndication feed by design — but note its
robots.txt still blocks generic bots (curl, Wget, ...) from /events, so
this script fetches only the dedicated .ics feed, at low frequency, and
does not crawl the rest of the site.

Coverage, deliberately narrow: only DE/AT/CH ("DACH"), only AIMS member
races (~27 at time of writing — mostly larger established marathons/half
marathons, not an exhaustive local calendar).

The .ics feed exposes country (via LOCATION) but not city or distance.
City is resolved from a small hand-verified lookup table below (built by
reading each event's real name/location once — the dataset is small
enough to check by hand rather than guess with regex against the race
director's postal address, which doesn't reliably match the race's own
city). Distance is inferred from the event name: "half marathon" /
"halbmarathon" -> 21.1k, otherwise defaults to 42.2k (AIMS is
marathon-focused; every current DACH entry is one or the other).

Scope, same as the other importers: event name, date, city, country,
sport/discipline, distance. Nothing else.

Usage:
    python3 aims_importer.py [--apply]

Output:
    db/imports/aims_<timestamp>.sql — INSERT statements with
    ON CONFLICT (slug) DO NOTHING, for manual review.
"""

import argparse
import re
from datetime import date, datetime
from pathlib import Path

from common import (
    apply_to_supabase,
    build_insert_sql,
    geocode_rows,
    slugify,
    USER_AGENT,
)
import urllib.request

HERE = Path(__file__).resolve().parent
OUTPUT_DIR = HERE.parent / "imports"

FEED_URL = "https://aims-worldrunning.org/events.ics"

COUNTRY_BY_LOCATION = {
    "Germany": "DE",
    "Austria": "AT",
    "Switzerland": "CH",
}

# Hand-verified city for each DACH AIMS race (see module docstring for why
# this isn't parsed automatically). Keyed by a substring of SUMMARY that
# uniquely identifies the race.
CITY_BY_NAME = {
    "Swissalpine Flims": "Flims",
    "Jungfrau-Marathon": "Interlaken",
    "Volksbank-Münster-Marathon": "Münster",
    "WACHAUmarathon": "Krems an der Donau",
    "Greifenseelauf Uster": "Uster",
    "Halfmarathon Altötting": "Altötting",
    "StraLugano": "Lugano",
    "BMW Berlin-Marathon": "Berlin",
    "Marathon München": "München",
    "3 Country Sparkasse Marathon": "Fürstenfeld",
    "Lausanne Marathon": "Lausanne",
    "Mainova Frankfurt Marathon": "Frankfurt am Main",
    "hella hamburg half marathon": "Hamburg",
    "SwissCityMarathon": "Luzern",
    "Ring Running Series": "Nürburg",
    "Neujahrsmarathon Zürich": "Zürich",
    "Johannesbad Thermen-Marathon": "Bad Füssing",
    "Generali Berlin Half Marathon": "Berlin",
    "ADAC Marathon Hannover": "Hannover",
    "Ochsner Sport Zürich Marathon": "Zürich",
    "Vienna City Marathon": "Wien",
    "Haspa Marathon Hamburg": "Hamburg",
    "Generali Genève Marathon": "Genève",
    "Salzburg Marathon": "Salzburg",
    "WVV Marathon Wuerzburg": "Würzburg",
}


def fetch_feed() -> str:
    req = urllib.request.Request(FEED_URL, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read().decode("utf-8", errors="ignore")


def unfold(ics_text: str) -> str:
    """iCalendar line-folding: continuation lines start with a space."""
    return re.sub(r"\r?\n ", "", ics_text)


def resolve_city(name: str) -> str | None:
    for key, city in CITY_BY_NAME.items():
        if key in name:
            return city
    return None


def classify_distance(name: str) -> tuple[str, str]:
    lower = name.lower()
    if "half marathon" in lower or "halfmarathon" in lower or "halbmarathon" in lower:
        return "21.1k", "Halbmarathon"
    return "42.2k", "Marathon"


def parse_events(ics_text: str) -> list[dict]:
    today = date.today()
    blocks = unfold(ics_text).split("BEGIN:VEVENT")[1:]
    rows = []
    seen_slugs: set[str] = set()

    for block in blocks:
        loc_m = re.search(r"LOCATION:([^\r\n]*)", block)
        if not loc_m:
            continue
        country_code = next(
            (iso for label, iso in COUNTRY_BY_LOCATION.items() if label in loc_m.group(1)),
            None,
        )
        if not country_code:
            continue

        name_m = re.search(r"SUMMARY:([^\r\n]*)", block)
        start_m = re.search(r"DTSTART:(\d{8})", block)
        if not name_m or not start_m:
            continue

        name = name_m.group(1).strip()
        event_date = datetime.strptime(start_m.group(1), "%Y%m%d").date()
        if event_date < today:
            continue

        city = resolve_city(name)
        distance_key, distance_label = classify_distance(name)

        slug_base = slugify(f"{name}-{event_date.year}")
        slug = slug_base
        suffix = 2
        while slug in seen_slugs:
            slug = f"{slug_base}-{suffix}"
            suffix += 1
        seen_slugs.add(slug)

        rows.append(
            {
                "slug": slug,
                "name": name,
                "sport_type": "running",
                "discipline": "road",
                "distance_key": distance_key,
                "distance_label": distance_label,
                "event_date": event_date,
                "city": city,
                "country_code": country_code,
            }
        )

    return rows


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--no-geocode", action="store_true", help="skip Nominatim geocoding (lat/lng left null)")
    parser.add_argument(
        "--apply",
        action="store_true",
        help="insert rows directly into Supabase via the REST API (in addition to writing the SQL file)",
    )
    args = parser.parse_args()

    print(f"Fetching AIMS calendar feed from {FEED_URL} ...")
    ics_text = fetch_feed()

    print("Parsing events...")
    rows = parse_events(ics_text)
    rows.sort(key=lambda r: r["event_date"])
    print(f"{len(rows)} DACH rows found.")

    unresolved = [r["name"] for r in rows if not r["city"]]
    if unresolved:
        print("No city match for (will insert with city=null):")
        for name in unresolved:
            print(f"  - {name}")

    if args.no_geocode:
        for r in rows:
            r["lat"], r["lng"] = None, None
    else:
        geocode_rows(rows)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    today = date.today()
    out_path = OUTPUT_DIR / f"aims_{today.strftime('%Y%m%d')}.sql"
    out_path.write_text(build_insert_sql(rows, "db/importers/aims_importer.py"), encoding="utf-8")

    if args.apply:
        print(f"Wrote {out_path} ({len(rows)} rows). Applying to Supabase now...")
        apply_to_supabase(rows)
    else:
        print(f"Wrote {out_path} ({len(rows)} rows). Nothing was executed against any database.")


if __name__ == "__main__":
    main()
