#!/usr/bin/env python3
"""
racenex event importer — ITRA (trail/ultra) race calendar

Source: https://itra.run/Races/RaceCalendar (International Trail Running
Association). Chosen because robots.txt for itra.run allows crawling with
no bot-specific restrictions (unlike ironman.com and hyrox.com, which
explicitly disallow ClaudeBot).

Scope, deliberately: event name, date, city, country, sport/discipline,
distance. NOTHING else. The source page also renders per-race "results
published / not received" status badges and links to result pages — those
are dropped during parsing and never touched. This importer must stay
that way; do not extend it to pull results or participant data.

Usage:
    python3 itra_importer.py [--limit N] [--countries DE,FR,IT,...] [--months N] [--apply]

Output:
    db/imports/itra_<timestamp>.sql — INSERT statements with
    ON CONFLICT (slug) DO NOTHING, for manual review.

    With --apply, the same rows are also inserted directly into
    Supabase via the REST API (service-role key from .env.local),
    with duplicate slugs ignored server-side. Without --apply,
    nothing is executed against any database.
"""

import argparse
import html as html_lib
import json
import re
import sys
import time
import unicodedata
import urllib.parse
import urllib.request
from datetime import date, timedelta
from pathlib import Path

HERE = Path(__file__).resolve().parent
CACHE_FILE = HERE / ".geocode_cache.json"
OUTPUT_DIR = HERE.parent / "imports"

CONTACT_EMAIL = "mathieu@roestermundt.de"
USER_AGENT = f"racenex-importer/0.1 (+https://github.com/mathieuroe/racenex; {CONTACT_EMAIL})"

DEFAULT_COUNTRIES = [
    "DE", "FR", "IT", "ES", "CH", "AT", "GB", "NL", "BE", "PT",
    "PL", "CZ", "SE", "NO", "DK", "FI", "IE", "GR", "HR", "SI",
    "SK", "HU", "RO", "LU", "IS", "EE", "LV", "LT",
]

MONTHS = {
    m: i
    for i, m in enumerate(
        [
            "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December",
        ],
        start=1,
    )
}

EVENT_PAT = re.compile(
    r"<div class='event_name'><a href='(?P<href>[^']+)'[^>]*><h4>(?P<name>[^<]+)</h4"
)
DATE_PAT = re.compile(
    r"<div class='date'><span>(?P<day>\d+)</span>\s*(?P<month>[A-Za-z]+)<d></d>\s*(?P<year>\d{4})</div>"
)
LOC_PAT = re.compile(
    r"<div class='location'>(?P<city>[^,<]*),?\s*[A-Za-z]*<img src='/images/CountryFlags/(?P<iso2>[a-z]{2})\.svg'"
)
RACE_PAT = re.compile(
    r"<div class='count'>(?P<km>[\d.]+)\s*k</div>"
)


def fetch_calendar_html(countries: list[str], date_start: date, date_end: date) -> str:
    """POST to the ITRA race calendar search and return the raw HTML response.

    Note: the site's own date-range filter did not reliably narrow results
    during testing, so we still filter client-side in parse_events(). The
    date params are sent anyway since they're harmless and may help on
    the server side.
    """
    session_url = "https://itra.run/Races/RaceCalendar"
    req = urllib.request.Request(session_url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=30) as resp:
        get_html = resp.read().decode("utf-8", errors="ignore")
        cookies = resp.headers.get_all("Set-Cookie") or []

    token_match = re.search(
        r'name="__RequestVerificationToken" type="hidden" value="([^"]*)"', get_html
    )
    if not token_match:
        raise RuntimeError("Could not find antiforgery token on ITRA calendar page")
    token = token_match.group(1)
    cookie_header = "; ".join(c.split(";")[0] for c in cookies)

    fields = [
        ("__RequestVerificationToken", token),
        ("Input.isDateFilterApplied", "true"),
        ("Input.DateStart", date_start.isoformat()),
        ("Input.DateEnd", date_end.isoformat()),
    ]
    for c in countries:
        fields.append(("Input.Country", c))

    body = urllib.parse.urlencode(fields).encode("utf-8")
    post_req = urllib.request.Request(
        session_url,
        data=body,
        headers={
            "User-Agent": USER_AGENT,
            "Cookie": cookie_header,
            "Content-Type": "application/x-www-form-urlencoded",
        },
        method="POST",
    )
    with urllib.request.urlopen(post_req, timeout=60) as resp:
        return resp.read().decode("utf-8", errors="ignore")


def extract_race_json_array(html_doc: str) -> list:
    marker = "var raceSearchJsonSidePopupNew = ["
    start = html_doc.find(marker)
    if start == -1:
        raise RuntimeError("raceSearchJsonSidePopupNew not found in response")
    arr_start = start + len(marker) - 1

    depth = 0
    in_str = False
    str_char = ""
    escape = False
    end = None
    for i in range(arr_start, len(html_doc)):
        c = html_doc[i]
        if in_str:
            if escape:
                escape = False
            elif c == "\\":
                escape = True
            elif c == str_char:
                in_str = False
        else:
            if c in ("'", '"'):
                in_str = True
                str_char = c
            elif c == "[":
                depth += 1
            elif c == "]":
                depth -= 1
                if depth == 0:
                    end = i
                    break
    if end is None:
        raise RuntimeError("Could not balance raceSearchJsonSidePopupNew array")

    raw = html_doc[arr_start : end + 1]
    cleaned = re.sub(r",\s*([}\]])", r"\1", raw)
    # source is a JS array literal, not strict JSON: it can contain raw
    # control characters (literal newlines) inside string values.
    return json.loads(cleaned, strict=False)


def slugify(text: str) -> str:
    normalized = unicodedata.normalize("NFKD", text)
    ascii_text = normalized.encode("ascii", "ignore").decode("ascii")
    ascii_text = ascii_text.lower()
    ascii_text = re.sub(r"[^a-z0-9]+", "-", ascii_text)
    return ascii_text.strip("-")


def classify_discipline(distance_km: float) -> str:
    return "ultra" if distance_km >= 80 else "trail"


def parse_events(html_doc: str, today: date, horizon_end: date) -> list[dict]:
    items = extract_race_json_array(html_doc)
    flat: list[str] = []
    for it in items:
        if isinstance(it, list):
            flat.extend(str(x) for x in it)
        else:
            flat.append(str(it))
    full_html = "\n".join(flat)

    matches = list(EVENT_PAT.finditer(full_html))
    rows = []
    seen_slugs: set[str] = set()

    for idx, m in enumerate(matches):
        start = m.end()
        end = matches[idx + 1].start() if idx + 1 < len(matches) else len(full_html)
        window = full_html[start:end]

        dm = DATE_PAT.search(window)
        lm = LOC_PAT.search(window)
        if not dm or not lm:
            continue
        try:
            event_date = date(int(dm.group("year")), MONTHS[dm.group("month")], int(dm.group("day")))
        except (ValueError, KeyError):
            continue
        if not (today <= event_date <= horizon_end):
            continue

        name = html_lib.unescape(m.group("name")).strip()
        city = html_lib.unescape(lm.group("city")).strip()
        country_code = lm.group("iso2").upper()

        distances = sorted({float(km) for km in RACE_PAT.findall(window)})
        if not distances:
            continue
        multi = len(distances) > 1

        for km in distances:
            distance_label = f"{km:g} km"
            row_name = f"{name} ({distance_label})" if multi else name
            slug_base = slugify(f"{name}-{km:g}k-{event_date.year}")
            slug = slug_base
            suffix = 2
            while slug in seen_slugs:
                slug = f"{slug_base}-{suffix}"
                suffix += 1
            seen_slugs.add(slug)

            rows.append(
                {
                    "slug": slug,
                    "name": row_name,
                    "sport_type": "running",
                    "discipline": classify_discipline(km),
                    "distance_key": f"{km:g}k",
                    "distance_label": distance_label,
                    "event_date": event_date,
                    "city": city or None,
                    "country_code": country_code,
                }
            )

    return rows


def load_geocode_cache() -> dict:
    if CACHE_FILE.exists():
        return json.loads(CACHE_FILE.read_text(encoding="utf-8"))
    return {}


def save_geocode_cache(cache: dict) -> None:
    CACHE_FILE.write_text(json.dumps(cache, indent=2, ensure_ascii=False), encoding="utf-8")


def geocode(city: str, country_code: str, cache: dict) -> tuple[float, float] | None:
    key = f"{city}|{country_code}"
    if key in cache:
        return tuple(cache[key]) if cache[key] else None

    params = urllib.parse.urlencode(
        {"q": f"{city}, {country_code}", "format": "jsonv2", "limit": 1}
    )
    url = f"https://nominatim.openstreetmap.org/search?{params}"
    req = urllib.request.Request(
        url,
        headers={"User-Agent": USER_AGENT, "Accept-Language": "en"},
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except Exception as exc:  # noqa: BLE001 - best-effort geocoding
        print(f"  ! geocode failed for {city}, {country_code}: {exc}", file=sys.stderr)
        cache[key] = None
        time.sleep(1)
        return None

    if not data:
        cache[key] = None
        time.sleep(1)
        return None

    lat, lng = float(data[0]["lat"]), float(data[0]["lon"])
    cache[key] = [lat, lng]
    time.sleep(1)  # Nominatim usage policy: max 1 request/second
    return lat, lng


def sql_escape(value: str) -> str:
    return value.replace("'", "''")


def build_insert_sql(rows: list[dict]) -> str:
    lines = [
        "-- Generated by db/importers/itra_importer.py — REVIEW BEFORE RUNNING.",
        "-- Source: ITRA race calendar (https://itra.run/Races/RaceCalendar).",
        "-- Only event-level metadata: name, date, place, sport, distance.",
        "-- No results or participant data included by design.",
        "",
        "insert into events",
        "  (slug, name, sport_type, discipline, distance_key, distance_label,",
        "   event_date, city, country_code, lat, lng, is_activated)",
        "values",
    ]
    value_rows = []
    for r in rows:
        lat = "null" if r["lat"] is None else repr(r["lat"])
        lng = "null" if r["lng"] is None else repr(r["lng"])
        city = "null" if not r["city"] else f"'{sql_escape(r['city'])}'"
        value_rows.append(
            "  ('{slug}', '{name}', '{sport_type}', '{discipline}', '{distance_key}', "
            "'{distance_label}', '{event_date}', {city}, '{country_code}', {lat}, {lng}, false)".format(
                slug=sql_escape(r["slug"]),
                name=sql_escape(r["name"]),
                sport_type=r["sport_type"],
                discipline=r["discipline"],
                distance_key=r["distance_key"],
                distance_label=sql_escape(r["distance_label"]),
                event_date=r["event_date"].isoformat(),
                city=city,
                country_code=r["country_code"],
                lat=lat,
                lng=lng,
            )
        )
    lines.append(",\n".join(value_rows))
    lines.append("on conflict (slug) do nothing;")
    return "\n".join(lines) + "\n"


def load_env_local() -> dict:
    env_path = HERE.parent.parent / ".env.local"
    env: dict[str, str] = {}
    if not env_path.exists():
        return env
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        value = value.strip()
        if value.startswith('"') and value.endswith('"'):
            value = value[1:-1]
        env[key.strip()] = value
    return env


def apply_to_supabase(rows: list[dict]) -> None:
    """Insert rows directly via the Supabase REST API (PostgREST), using the
    service-role key so RLS doesn't block it. Duplicate slugs are ignored
    server-side (on_conflict=slug + resolution=ignore-duplicates), same
    semantics as the SQL file's ON CONFLICT (slug) DO NOTHING.
    """
    env = load_env_local()
    base_url = env.get("NEXT_PUBLIC_SUPABASE_URL")
    service_key = env.get("SUPABASE_SECRET_KEY") or env.get("SUPABASE_SERVICE_ROLE_KEY")
    if not base_url or not service_key:
        raise RuntimeError(
            "NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY not found in .env.local — "
            "run `vercel env pull .env.local` first."
        )

    payload = [
        {
            "slug": r["slug"],
            "name": r["name"],
            "sport_type": r["sport_type"],
            "discipline": r["discipline"],
            "distance_key": r["distance_key"],
            "distance_label": r["distance_label"],
            "event_date": r["event_date"].isoformat(),
            "city": r["city"],
            "country_code": r["country_code"],
            "lat": r["lat"],
            "lng": r["lng"],
            "is_activated": False,
        }
        for r in rows
    ]

    url = f"{base_url}/rest/v1/events?on_conflict=slug"
    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        method="POST",
        headers={
            "apikey": service_key,
            "Authorization": f"Bearer {service_key}",
            "Content-Type": "application/json",
            "Prefer": "resolution=ignore-duplicates,return=representation",
        },
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        result = json.loads(resp.read().decode("utf-8"))
    print(f"Applied to Supabase: {len(result)} of {len(rows)} rows inserted (rest were duplicate slugs).")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--limit", type=int, default=50, help="max number of rows to include (default: 50)")
    parser.add_argument("--countries", type=str, default=",".join(DEFAULT_COUNTRIES), help="comma-separated ISO-2 country codes")
    parser.add_argument("--months", type=int, default=6, help="how many months ahead to include (default: 6)")
    parser.add_argument("--no-geocode", action="store_true", help="skip Nominatim geocoding (lat/lng left null)")
    parser.add_argument(
        "--apply",
        action="store_true",
        help="insert rows directly into Supabase via the REST API (in addition to writing the SQL file)",
    )
    args = parser.parse_args()

    countries = [c.strip().upper() for c in args.countries.split(",") if c.strip()]
    today = date.today()
    horizon_end = today + timedelta(days=30 * args.months)

    print(f"Fetching ITRA calendar for {len(countries)} countries, {today} .. {horizon_end} ...")
    html_doc = fetch_calendar_html(countries, today, horizon_end)

    print("Parsing events...")
    rows = parse_events(html_doc, today, horizon_end)
    rows.sort(key=lambda r: r["event_date"])
    rows = rows[: args.limit]
    print(f"{len(rows)} rows selected (limit={args.limit}).")

    cache = load_geocode_cache()
    if args.no_geocode:
        for r in rows:
            r["lat"], r["lng"] = None, None
    else:
        unique_places = sorted({(r["city"], r["country_code"]) for r in rows if r["city"]})
        print(f"Geocoding {len(unique_places)} unique places via Nominatim (1 req/sec)...")
        for city, country_code in unique_places:
            geocode(city, country_code, cache)
        save_geocode_cache(cache)
        for r in rows:
            if r["city"]:
                coords = cache.get(f"{r['city']}|{r['country_code']}")
                r["lat"], r["lng"] = tuple(coords) if coords else (None, None)
            else:
                r["lat"], r["lng"] = None, None

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    out_path = OUTPUT_DIR / f"itra_{today.strftime('%Y%m%d')}.sql"
    out_path.write_text(build_insert_sql(rows), encoding="utf-8")

    if args.apply:
        print(f"Wrote {out_path} ({len(rows)} rows). Applying to Supabase now...")
        apply_to_supabase(rows)
    else:
        print(f"Wrote {out_path} ({len(rows)} rows). Nothing was executed against any database.")


if __name__ == "__main__":
    main()
