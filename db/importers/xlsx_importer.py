#!/usr/bin/env python3
"""
racenex event importer — manual xlsx import (Ironman / Ironman 70.3 / Hyrox)

Ironman.com and hyrox.com disallow ClaudeBot in robots.txt, so this data
was not scraped by Claude — the user pulled it themselves as a human
visitor and exported it to racenex_events_complete.xlsx, which this
script only reads from local disk.

Expected columns: event_id, name, sport, date, location, country_code,
url, höhenmeter. Only name/sport/date/location/country_code are used —
url and höhenmeter (elevation) aren't part of the events schema (yet).

Requires: pandas, openpyxl (not stdlib — this is a manual one-off tool,
unlike itra_importer.py which is meant to run unattended).

Usage:
    python3 xlsx_importer.py [--file PATH] [--include-past] [--apply]

Output:
    db/imports/manual_<timestamp>.sql — INSERT statements with
    ON CONFLICT (slug) DO NOTHING, for manual review.
"""

import argparse
from datetime import date
from pathlib import Path

import pandas as pd

from common import apply_to_supabase, build_insert_sql, geocode_rows, slugify

HERE = Path(__file__).resolve().parent
PROJECT_ROOT = HERE.parent.parent
OUTPUT_DIR = HERE.parent / "imports"
DEFAULT_FILE = PROJECT_ROOT / "racenex_events_complete.xlsx"

# location strings end in a country name, but the source file's own
# country_code column has a handful of copy-paste errors (e.g. "XX",
# or Thailand rows tagged "GB") — derive the real code from the country
# name in `location` instead, falling back to the given code if unknown.
COUNTRY_NAME_TO_ISO2 = {
    "UAE": "AE",
    "Austria": "AT",
    "Germany": "DE",
    "Spain": "ES",
    "Bahrain": "BH",
    "Australia": "AU",
    "New Zealand": "NZ",
    "Philippines": "PH",
    "Ireland": "IE",
    "Poland": "PL",
    "Sweden": "SE",
    "Netherlands": "NL",
    "United Kingdom": "GB",
    "UK": "GB",
    "Thailand": "TH",
    "Japan": "JP",
    "Luxemburg": "LU",
    "Singapore": "SG",
    "Italy": "IT",
}

# sport column -> (sport_type, distance_key, distance_label)
SPORT_MAP = {
    "Ironman 70.3": ("triathlon", "70.3", "70.3 (Half)"),
    "Ironman": ("triathlon", "140.6", "Ironman (Full)"),
    "Hyrox": ("hyrox", None, None),
}


def load_rows(path: Path, today: date, include_past: bool) -> list[dict]:
    df = pd.read_excel(path)
    rows = []
    seen_slugs: set[str] = set()

    for _, r in df.iterrows():
        event_date = r["date"].date() if hasattr(r["date"], "date") else r["date"]
        if not include_past and event_date < today:
            continue

        sport_raw = str(r["sport"]).strip()
        mapping = SPORT_MAP.get(sport_raw)
        if not mapping:
            print(f"  ! unknown sport '{sport_raw}' for '{r['name']}' — skipping")
            continue
        sport_type, distance_key, distance_label = mapping

        location = str(r["location"])
        city = location.split(",")[0].strip()
        country_name = location.split(",")[-1].strip()
        country_code = COUNTRY_NAME_TO_ISO2.get(country_name, str(r["country_code"]).strip())

        name = str(r["name"]).strip()
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
                "sport_type": sport_type,
                "discipline": None,
                "distance_key": distance_key,
                "distance_label": distance_label,
                "event_date": event_date,
                "city": city or None,
                "country_code": country_code,
            }
        )

    return rows


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--file", type=str, default=str(DEFAULT_FILE), help="path to the xlsx file")
    parser.add_argument("--include-past", action="store_true", help="also include events before today")
    parser.add_argument("--no-geocode", action="store_true", help="skip Nominatim geocoding (lat/lng left null)")
    parser.add_argument(
        "--apply",
        action="store_true",
        help="insert rows directly into Supabase via the REST API (in addition to writing the SQL file)",
    )
    args = parser.parse_args()

    path = Path(args.file)
    today = date.today()

    print(f"Reading {path} ...")
    rows = load_rows(path, today, args.include_past)
    rows.sort(key=lambda r: r["event_date"])
    print(f"{len(rows)} rows selected" + ("" if args.include_past else f" (future only, from {today})") + ".")

    if args.no_geocode:
        for r in rows:
            r["lat"], r["lng"] = None, None
    else:
        geocode_rows(rows)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    out_path = OUTPUT_DIR / f"manual_{today.strftime('%Y%m%d')}.sql"
    out_path.write_text(build_insert_sql(rows, "db/importers/xlsx_importer.py"), encoding="utf-8")

    if args.apply:
        print(f"Wrote {out_path} ({len(rows)} rows). Applying to Supabase now...")
        apply_to_supabase(rows)
    else:
        print(f"Wrote {out_path} ({len(rows)} rows). Nothing was executed against any database.")


if __name__ == "__main__":
    main()
