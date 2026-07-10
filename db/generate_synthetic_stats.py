#!/usr/bin/env python3
"""
racenex — Generator für synthetische, statistisch plausible Event-Aggregate.
Erzeugt event_stats-Daten (Histogramm, Splits, AK-Verteilung) für den Bau/Test
der Anzeige-Logik. KEINE echten Personendaten — reine Statistik zum Entwickeln.

Output:
  - racenex-seed.sql   (INSERT-Statements für Supabase)
  - racenex-seed.json  (dieselben Daten als JSON, z.B. für Frontend-Mock)
"""
import json
import math
import random

random.seed(42)  # reproduzierbar

def fmt(sec):
    h = sec // 3600
    m = (sec % 3600) // 60
    s = sec % 60
    return f"{h}:{m:02d}:{s:02d}"

def truncated_normal(mean, sd, lo, hi):
    while True:
        v = random.gauss(mean, sd)
        if lo <= v <= hi:
            return v

def build_distribution(mean_sec, sd_sec, n, bucket_sec, lo_sec, hi_sec):
    """Histogramm-Buckets aus einer Normalverteilung."""
    samples = [truncated_normal(mean_sec, sd_sec, lo_sec, hi_sec) for _ in range(n)]
    buckets = {}
    start = (lo_sec // bucket_sec) * bucket_sec
    end = ((hi_sec // bucket_sec) + 1) * bucket_sec
    b = start
    while b < end:
        buckets[b] = 0
        b += bucket_sec
    for s in samples:
        key = (int(s) // bucket_sec) * bucket_sec
        if key in buckets:
            buckets[key] += 1
    dist = [{"from_sec": k, "to_sec": k + bucket_sec, "count": v}
            for k, v in sorted(buckets.items())]
    samples_sorted = sorted(samples)
    median = int(samples_sorted[len(samples_sorted)//2])
    avg = int(sum(samples)/len(samples))
    best = int(samples_sorted[0])
    return dist, avg, median, best

def ag_distribution(total, bands):
    """Altersgruppen-Verteilung mit plausiblen Anteilen & Medianen."""
    out = []
    for ag, share, med in bands:
        out.append({"ag": ag, "count": int(total*share), "median_sec": med})
    return out


EVENTS = []

# ---------- 1) IRONMAN 70.3 (Venice-ähnlich) ----------
# realistische Finish-Verteilung: Ø ~5:42, sd ~48min, Range 4:00–8:30
n = 2847
dist, avg, med, best = build_distribution(
    mean_sec=5*3600+42*60, sd_sec=48*60, n=n,
    bucket_sec=1800, lo_sec=4*3600, hi_sec=8*3600+30*60)
EVENTS.append({
    "slug": "ironman-703-venice-2027",
    "name": "IRONMAN 70.3 Venice",
    "sport_type": "triathlon",
    "year": 2026,
    "finisher_count": n,
    "avg": avg, "median": med, "best": best,
    "distribution": dist,
    "splits": {
        "swim": {"avg_sec": 41*60, "top10_sec": 32*60, "note": "1,9 km · mit Strömung"},
        "bike": {"avg_sec": 2*3600+58*60, "top10_sec": 2*3600+31*60, "note": "90 km · 920 hm"},
        "run":  {"avg_sec": 1*3600+52*60, "top10_sec": 1*3600+36*60, "note": "21,1 km · flach"},
    },
    "ag_distribution": ag_distribution(n, [
        ("AK25-29", 0.12, 5*3600+30*60),
        ("AK30-34", 0.20, 5*3600+28*60),
        ("AK35-39", 0.22, 5*3600+35*60),
        ("AK40-44", 0.19, 5*3600+40*60),
        ("AK45-49", 0.14, 5*3600+52*60),
        ("AK50+",   0.13, 6*3600+10*60),
    ]),
    "source_note": "SYNTHETISCH — statistisch plausibles Modell zum Bau, keine echten Daten",
})

# ---------- 2) MARATHON (München/Frankfurt-ähnlich) ----------
n = 9120
dist, avg, med, best = build_distribution(
    mean_sec=4*3600+12*60, sd_sec=42*60, n=n,
    bucket_sec=1800, lo_sec=2*3600+20*60, hi_sec=6*3600+30*60)
EVENTS.append({
    "slug": "marathon-muenchen-2026",
    "name": "München Marathon",
    "sport_type": "running",
    "year": 2025,
    "finisher_count": n,
    "avg": avg, "median": med, "best": best,
    "distribution": dist,
    "splits": {
        "first_half": {"avg_sec": 2*3600+2*60, "top10_sec": 1*3600+28*60, "note": "flach, schnell"},
        "second_half":{"avg_sec": 2*3600+10*60, "top10_sec": 1*3600+31*60, "note": "leicht wellig"},
    },
    "ag_distribution": ag_distribution(n, [
        ("AK<30",   0.14, 4*3600+0*60),
        ("AK30-34", 0.19, 4*3600+5*60),
        ("AK35-39", 0.21, 4*3600+10*60),
        ("AK40-44", 0.18, 4*3600+15*60),
        ("AK45-49", 0.15, 4*3600+22*60),
        ("AK50+",   0.13, 4*3600+35*60),
    ]),
    "source_note": "SYNTHETISCH — statistisch plausibles Modell zum Bau, keine echten Daten",
})

# ---------- 3) HYROX (München-ähnlich) ----------
n = 3400
dist, avg, med, best = build_distribution(
    mean_sec=1*3600+18*60, sd_sec=13*60, n=n,
    bucket_sec=300, lo_sec=52*60, hi_sec=2*3600)
EVENTS.append({
    "slug": "hyrox-muenchen-2026",
    "name": "HYROX München",
    "sport_type": "hyrox",
    "year": 2026,
    "finisher_count": n,
    "avg": avg, "median": med, "best": best,
    "distribution": dist,
    "splits": {
        "running_total": {"avg_sec": 38*60, "top10_sec": 30*60, "note": "8×1 km"},
        "stations_total":{"avg_sec": 40*60, "top10_sec": 30*60, "note": "8 Stationen"},
        "roxzone":       {"avg_sec": 4*60,  "top10_sec": 2*60,  "note": "Übergänge"},
    },
    "ag_distribution": ag_distribution(n, [
        ("AK<30",   0.28, 1*3600+14*60),
        ("AK30-34", 0.24, 1*3600+16*60),
        ("AK35-39", 0.20, 1*3600+18*60),
        ("AK40-44", 0.15, 1*3600+22*60),
        ("AK45+",   0.13, 1*3600+30*60),
    ]),
    "source_note": "SYNTHETISCH — statistisch plausibles Modell zum Bau, keine echten Daten",
})


# ---------- SQL-Ausgabe ----------
def sql_escape(s):
    return s.replace("'", "''")

sql_lines = [
    "-- racenex — synthetische Seed-Daten (event_stats)",
    "-- ACHTUNG: SYNTHETISCH, nur zum Bau/Test. Vor Launch durch echte Aggregate ersetzen.",
    "-- Annahme: passende events-Zeilen existieren (per slug verknüpft).",
    "",
]
for e in EVENTS:
    sql_lines.append(f"-- {e['name']} ({e['year']})")
    sql_lines.append(
        "insert into event_stats (event_id, year, finisher_count, avg_finish_sec, "
        "median_finish_sec, best_finish_sec, distribution, splits, ag_distribution, source_note)"
    )
    sql_lines.append(
        f"select id, {e['year']}, {e['finisher_count']}, {e['avg']}, {e['median']}, {e['best']}, "
        f"'{json.dumps(e['distribution'])}'::jsonb, "
        f"'{json.dumps(e['splits'])}'::jsonb, "
        f"'{json.dumps(e['ag_distribution'])}'::jsonb, "
        f"'{sql_escape(e['source_note'])}'"
    )
    sql_lines.append(f"from events where slug = '{e['slug']}';")
    sql_lines.append("")

with open("/home/claude/racenex-seed.sql", "w") as f:
    f.write("\n".join(sql_lines))

# ---------- JSON-Ausgabe (fürs Frontend-Mock) ----------
with open("/home/claude/racenex-seed.json", "w") as f:
    json.dump(EVENTS, f, indent=2, ensure_ascii=False)

# ---------- Konsolen-Report ----------
print("Synthetische Aggregate erzeugt:\n")
for e in EVENTS:
    print(f"  {e['name']} ({e['sport_type']}, {e['year']})")
    print(f"    Finisher: {e['finisher_count']}")
    print(f"    Ø {fmt(e['avg'])} · Median {fmt(e['median'])} · Best {fmt(e['best'])}")
    print(f"    Histogramm-Buckets: {len(e['distribution'])}")
    print(f"    AK-Bänder: {len(e['ag_distribution'])}")
    print()
print("Dateien: racenex-seed.sql · racenex-seed.json")
