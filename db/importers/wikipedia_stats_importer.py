#!/usr/bin/env python3
"""
racenex event_stats importer — Wikipedia (finisher counts + winner times)

Source: Wikipedia, via the official MediaWiki Action API
(de.wikipedia.org/w/api.php). CC BY-SA licensed, explicitly meant for
reuse with attribution — a genuinely open source, unlike the
commercial timing providers (MikaTiming, RaceResult, Datasport) that
were checked and ruled out for this feature.

Scope: German-language Wikipedia articles for major marathons often
have a "Teilnehmerstatistik" section (finisher count per year, as a
bullet list) and/or a "Siegerliste" section (winner name/time per
year, as a table). This script extracts both where present and merges
them into event_stats rows per year: finisher_count and
best_finish_sec (the men's winner time — used as "best", matching the
column's meaning elsewhere in this schema). avg/median/distribution/
ag_distribution are left null; Wikipedia doesn't have full-field data,
only the two aggregate numbers.

For each racenex event this is run against, it:
  1. Uses Wikipedia's search API to find the best-matching article
     (or takes --wiki-title to skip searching and use an exact title)
  2. Parses whatever of the two sections exist
  3. Reports what it found and writes one event_stats row per year to
     the output SQL — nothing is guessed or filled in for years with
     no data.

Usage:
    python3 wikipedia_stats_importer.py \
        --racenex-event <events.id> --query "Frankfurt Marathon" [--wiki-title "Frankfurt-Marathon"] [--apply]
"""

import argparse
import json
import re
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path

from common import USER_AGENT, load_env_local

HERE = Path(__file__).resolve().parent
OUTPUT_DIR = HERE.parent / "imports"

API_URL = "https://de.wikipedia.org/w/api.php"

# Sanity bounds — catch parser mis-hits (a wrong table in the same
# article, a garbled year) rather than trust every regex match blindly.
MIN_YEAR = 1970
MAX_YEAR = date.today().year
MIN_FINISH_SEC = 3300  # ~55:00 — faster than any elite half marathon
MAX_FINISH_SEC = 16000  # ~4:26 — slower than any competitive-field winner


def api_get(params: dict) -> dict:
    params = {**params, "format": "json"}
    url = f"{API_URL}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))


def find_article(query: str) -> str | None:
    data = api_get({"action": "opensearch", "search": query, "limit": 1, "namespace": 0})
    titles = data[1] if len(data) > 1 else []
    return titles[0] if titles else None


def fetch_wikitext(title: str) -> str:
    data = api_get({"action": "parse", "page": title, "prop": "wikitext"})
    if "error" in data:
        raise RuntimeError(f"Wikipedia API error for '{title}': {data['error'].get('info')}")
    return data["parse"]["wikitext"]["*"]


NON_RUNNING_HEADINGS = ["Inlineskating", "Rollstuhl", "Handbike", "Skating"]


def truncate_at_other_disciplines(wikitext: str) -> str:
    """Some articles cover multiple disciplines of the same event weekend
    (running marathon + inline skating + wheelchair + handbike), each with
    its own Siegerliste/Teilnehmer numbers. Cuts the text at the first such
    heading so only the running marathon's own numbers get parsed."""
    cut = len(wikitext)
    for heading in NON_RUNNING_HEADINGS:
        m = re.search(rf"==\s*(?:\{{\{{Anker\|[^}}]*\}}\}})?\s*{heading}", wikitext)
        if m:
            cut = min(cut, m.start())
    return wikitext[:cut]


def parse_finisher_counts(wikitext: str) -> dict[int, int]:
    """Two finisher-count formats show up across articles: a bullet list
    ("* YYYY Teilnehmer: N.NNN", e.g. Frankfurt) or a per-year wikitable
    with the marathon-distance finisher count as its first data column
    (e.g. "|2025\\n|5187\\n|...", e.g. München). Tries the bullet form
    first since it's unambiguous; falls back to the table form."""
    out: dict[int, int] = {}
    for m in re.finditer(r"(\d{4})\s+Teilnehmer:\s*([\d.]+)", wikitext):
        year = int(m.group(1))
        if not (MIN_YEAR <= year <= MAX_YEAR):
            continue
        count = int(m.group(2).replace(".", ""))
        out[year] = count
    if out:
        return out

    for m in re.finditer(r"\|\s*(20[0-2]\d)\s*\n\|\s*([\d.]+)\s*\n", wikitext):
        year = int(m.group(1))
        if not (MIN_YEAR <= year <= MAX_YEAR):
            continue
        count = int(m.group(2).replace(".", ""))
        if 100 <= count <= 100_000:
            out[year] = count
    if out:
        return out

    # Third format: one row per line, cells separated by '||', year cell
    # may carry a <ref>...</ref> citation before the next '||'.
    for m in re.finditer(r"\|\s*(20[0-2]\d)(?:<ref[^|]*?</ref>)?\s*\|\|\s*([\d.]+)", wikitext):
        year = int(m.group(1))
        if not (MIN_YEAR <= year <= MAX_YEAR):
            continue
        count = int(m.group(2).replace(".", ""))
        if 100 <= count <= 100_000:
            out[year] = count
    return out


def parse_winner_times(wikitext: str) -> dict[int, int]:
    """Matches {{DatumZelle|YYYY-MM-DD}} ... H:MM:SS row pairs used in
    winner-list tables, regardless of the section heading text
    ("Siegerliste", "Siegerlisten", ...). Table rows are split on '|-'.
    If an article has multiple winner tables (e.g. marathon + half
    marathon distances both use this pattern), the last matching row per
    year wins — acceptable for this best-effort aggregate, not exact."""
    out: dict[int, int] = {}
    for row in wikitext.split("|-"):
        date_m = re.search(r"\{\{DatumZelle\|(\d{4})-\d{2}-\d{2}", row)
        time_m = re.search(r"(\d):(\d{2}):(\d{2})", row)
        if not date_m or not time_m:
            continue
        year = int(date_m.group(1))
        if not (MIN_YEAR <= year <= MAX_YEAR):
            continue
        h, mi, s = (int(x) for x in time_m.groups())
        sec = h * 3600 + mi * 60 + s
        if not (MIN_FINISH_SEC <= sec <= MAX_FINISH_SEC):
            continue
        out[year] = sec
    return out


def build_sql(racenex_event_id: str, year: int, finisher_count: int | None, best_finish_sec: int | None, source_note: str) -> str:
    finisher_sql = "null" if finisher_count is None else str(finisher_count)
    best_sql = "null" if best_finish_sec is None else str(best_finish_sec)
    return (
        "insert into event_stats (event_id, year, finisher_count, best_finish_sec, source_note)\n"
        f"values ('{racenex_event_id}', {year}, {finisher_sql}, {best_sql}, '{source_note.replace(chr(39), chr(39)*2)}')\n"
        "on conflict (event_id, year) do update set\n"
        "  finisher_count = coalesce(excluded.finisher_count, event_stats.finisher_count),\n"
        "  best_finish_sec = coalesce(excluded.best_finish_sec, event_stats.best_finish_sec),\n"
        "  source_note = excluded.source_note;\n"
    )


def apply_row(racenex_event_id: str, year: int, finisher_count: int | None, best_finish_sec: int | None, source_note: str) -> None:
    env = load_env_local()
    base_url = env.get("NEXT_PUBLIC_SUPABASE_URL")
    service_key = env.get("SUPABASE_SECRET_KEY") or env.get("SUPABASE_SERVICE_ROLE_KEY")
    if not base_url or not service_key:
        raise RuntimeError("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY not found in .env.local")

    payload = {
        "event_id": racenex_event_id,
        "year": year,
        "finisher_count": finisher_count,
        "best_finish_sec": best_finish_sec,
        "source_note": source_note,
    }
    url = f"{base_url}/rest/v1/event_stats?on_conflict=event_id,year"
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        method="POST",
        headers={
            "apikey": service_key,
            "Authorization": f"Bearer {service_key}",
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates,return=minimal",
        },
    )
    urllib.request.urlopen(req, timeout=30).read()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--racenex-event", required=True, help="racenex events.id (uuid)")
    parser.add_argument("--query", required=True, help="search query to find the Wikipedia article (e.g. 'Frankfurt Marathon')")
    parser.add_argument("--wiki-title", help="exact Wikipedia article title (skips search)")
    parser.add_argument("--years", type=int, default=5, help="how many most-recent years to include (default: 5)")
    parser.add_argument("--apply", action="store_true", help="also insert directly into Supabase")
    args = parser.parse_args()

    title = args.wiki_title or find_article(args.query)
    if not title:
        print(f"No Wikipedia article found for '{args.query}'.")
        return
    print(f"Using article: {title}")

    wikitext = truncate_at_other_disciplines(fetch_wikitext(title))
    finishers = parse_finisher_counts(wikitext)
    winners = parse_winner_times(wikitext)

    if not finishers and not winners:
        print("Neither 'Teilnehmerstatistik' nor 'Siegerliste' section found — nothing to import.")
        return

    years = sorted(set(finishers) | set(winners), reverse=True)[: args.years]
    if not years:
        print("No years with data found.")
        return

    source_note = f"Wikipedia de.wikipedia.org/wiki/{urllib.parse.quote(title)}, aggregated {date.today().isoformat()}"

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    out_path = OUTPUT_DIR / f"wikipedia_stats_{title.replace(' ', '_')}.sql"
    sql_parts = []

    applied = 0
    for year in years:
        fc = finishers.get(year)
        best = winners.get(year)
        if fc is None:
            # event_stats.finisher_count is NOT NULL — a year with only a
            # winner time and no known finisher count can't be written
            # without lying about the count, so it's skipped rather than
            # defaulted to 0.
            print(f"  {year}: finisher_count=None, best_finish_sec={best} — skipped (no finisher_count)")
            continue
        print(f"  {year}: finisher_count={fc}, best_finish_sec={best}")
        sql_parts.append(build_sql(args.racenex_event, year, fc, best, source_note))
        if args.apply:
            apply_row(args.racenex_event, year, fc, best, source_note)
        applied += 1

    out_path.write_text("\n".join(sql_parts), encoding="utf-8")
    if args.apply:
        print(f"Applied {applied} year(s) to Supabase. Wrote {out_path} for reference.")
    else:
        print(f"Wrote {out_path} ({applied} year(s)). Nothing was executed against any database.")


if __name__ == "__main__":
    main()
