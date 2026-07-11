"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { SPORT_LABEL } from "@/lib/sportLabels";

export type EventCard = {
  id: string;
  slug: string;
  name: string;
  sport_type: string;
  discipline: string | null;
  distance_key: string | null;
  distance_label: string | null;
  event_date: string | null;
  city: string | null;
  country_code: string | null;
};

function formatDate(iso: string | null): string {
  if (!iso) return "Datum offen";
  return new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const DISTANCE_ORDER = [
  "70.3 (Half)",
  "Ironman (Full)",
  "Bis 25 km",
  "25–50 km",
  "50–100 km",
  "100+ km",
];

// Buckets distance into a small, filterable set of categories. Triathlon
// distances are already clean (70.3 vs. full Ironman); running/trail spans
// 10–150+ km, so it's bucketed by range instead of shown raw.
function distanceBucket(event: EventCard): string | null {
  if (event.sport_type === "triathlon") {
    return event.distance_key === "140.6"
      ? "Ironman (Full)"
      : (event.distance_label ?? null);
  }
  if (event.sport_type === "running" && event.distance_key) {
    const km = parseInt(event.distance_key, 10);
    if (Number.isNaN(km)) return null;
    if (km < 25) return "Bis 25 km";
    if (km < 50) return "25–50 km";
    if (km < 100) return "50–100 km";
    return "100+ km";
  }
  return null;
}

type SortMode = "date" | "city";

export default function EventsBrowser({ events }: { events: EventCard[] }) {
  const [query, setQuery] = useState("");
  const [sports, setSports] = useState<Set<string>>(new Set());
  const [distances, setDistances] = useState<Set<string>>(new Set());
  const [country, setCountry] = useState("");
  const [includePast, setIncludePast] = useState(false);
  const [sort, setSort] = useState<SortMode>("date");

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const availableSports = useMemo(() => {
    const present = new Set(events.map((e) => e.sport_type));
    return Array.from(present).sort();
  }, [events]);

  const availableCountries = useMemo(() => {
    const present = new Set(
      events.map((e) => e.country_code).filter(Boolean) as string[],
    );
    return Array.from(present).sort();
  }, [events]);

  // Distance options depend on which sports are relevant right now, so the
  // list only ever shows buckets that actually apply (e.g. no 70.3/Ironman
  // chips once Triathlon is deselected).
  const availableDistances = useMemo(() => {
    const relevant =
      sports.size > 0 ? events.filter((e) => sports.has(e.sport_type)) : events;
    const present = new Set(
      relevant.map(distanceBucket).filter(Boolean) as string[],
    );
    return DISTANCE_ORDER.filter((d) => present.has(d));
  }, [events, sports]);

  function toggleSport(sport: string) {
    setSports((prev) => {
      const next = new Set(prev);
      if (next.has(sport)) next.delete(sport);
      else next.add(sport);
      return next;
    });
  }

  function toggleDistance(bucket: string) {
    setDistances((prev) => {
      const next = new Set(prev);
      if (next.has(bucket)) next.delete(bucket);
      else next.add(bucket);
      return next;
    });
  }

  // Selected distance buckets that no longer apply (e.g. the sport that
  // owned them was deselected) are ignored rather than left filtering
  // silently against a chip the user can no longer see or clear.
  const effectiveDistances = useMemo(
    () => new Set([...distances].filter((d) => availableDistances.includes(d))),
    [distances, availableDistances],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const result = events.filter((e) => {
      if (!includePast && e.event_date && e.event_date < today) return false;
      if (sports.size > 0 && !sports.has(e.sport_type)) return false;
      if (
        effectiveDistances.size > 0 &&
        !effectiveDistances.has(distanceBucket(e) ?? "")
      )
        return false;
      if (country && e.country_code !== country) return false;
      if (!q) return true;
      return (
        e.name.toLowerCase().includes(q) ||
        (e.city ?? "").toLowerCase().includes(q)
      );
    });

    if (sort === "city") {
      return result
        .slice()
        .sort(
          (a, b) =>
            (a.city ?? "").localeCompare(b.city ?? "") ||
            (a.event_date ?? "").localeCompare(b.event_date ?? ""),
        );
    }
    return result
      .slice()
      .sort((a, b) => (a.event_date ?? "").localeCompare(b.event_date ?? ""));
  }, [
    events,
    query,
    sports,
    effectiveDistances,
    country,
    includePast,
    today,
    sort,
  ]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Event oder Stadt suchen…"
          className="min-w-[220px] flex-1 rounded-[9px] border-[1.5px] border-line bg-void px-[15px] py-3.5 text-[15.5px] text-chalk transition-colors placeholder:text-[#5A636E] focus:border-signal focus:outline-none"
        />

        {availableCountries.length > 1 && (
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="shrink-0 rounded-[9px] border-[1.5px] border-line bg-void px-4 py-3.5 font-display text-[13px] font-bold uppercase tracking-[0.02em] text-chalk focus:border-signal focus:outline-none"
          >
            <option value="">Alle Länder</option>
            {availableCountries.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        )}

        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortMode)}
          className="shrink-0 rounded-[9px] border-[1.5px] border-line bg-void px-4 py-3.5 font-display text-[13px] font-bold uppercase tracking-[0.02em] text-chalk focus:border-signal focus:outline-none"
        >
          <option value="date">Nach Datum</option>
          <option value="city">Nach Ort</option>
        </select>

        <button
          type="button"
          onClick={() => setIncludePast((v) => !v)}
          className={
            includePast
              ? "shrink-0 rounded-[9px] border-[1.5px] border-signal bg-signal px-4 py-3.5 font-display text-[13px] font-bold italic uppercase tracking-[0.04em] text-white"
              : "shrink-0 rounded-[9px] border-[1.5px] border-line bg-carbon px-4 py-3.5 font-display text-[13px] font-bold italic uppercase tracking-[0.04em] text-fog hover:border-signal hover:text-signal"
          }
        >
          Auch vergangene
        </button>
      </div>

      {availableSports.length > 1 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {availableSports.map((sport) => {
            const active = sports.has(sport);
            return (
              <button
                key={sport}
                type="button"
                onClick={() => toggleSport(sport)}
                className={
                  active
                    ? "rounded-full border-[1.5px] border-signal bg-signal px-3.5 py-1.5 font-display text-[12px] font-bold italic uppercase tracking-[0.03em] text-white"
                    : "rounded-full border-[1.5px] border-line bg-carbon px-3.5 py-1.5 font-display text-[12px] font-bold italic uppercase tracking-[0.03em] text-fog hover:border-signal hover:text-signal"
                }
              >
                {SPORT_LABEL[sport] ?? sport}
              </button>
            );
          })}
        </div>
      )}

      {availableDistances.length > 1 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {availableDistances.map((bucket) => {
            const active = effectiveDistances.has(bucket);
            return (
              <button
                key={bucket}
                type="button"
                onClick={() => toggleDistance(bucket)}
                className={
                  active
                    ? "rounded-full border-[1.5px] border-signal-dim bg-signal-dim px-3.5 py-1.5 font-display text-[12px] font-bold italic uppercase tracking-[0.03em] text-white"
                    : "rounded-full border-[1.5px] border-line bg-carbon px-3.5 py-1.5 font-display text-[12px] font-bold italic uppercase tracking-[0.03em] text-fog hover:border-signal-dim hover:text-signal-dim"
                }
              >
                {bucket}
              </button>
            );
          })}
        </div>
      )}

      <p className="mt-4 text-[13.5px] text-fog">
        {filtered.length} {filtered.length === 1 ? "Event" : "Events"}
      </p>

      {filtered.length === 0 ? (
        <div className="mt-6 rounded-xl border border-line bg-carbon px-6 py-10 text-center text-[14.5px] text-fog">
          Kein Event gefunden — Filter anpassen?
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-px overflow-hidden rounded-[14px] border border-line bg-line md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((event) => (
            <Link
              key={event.id}
              href={`/event/${event.slug}`}
              className="flex flex-col gap-3 bg-carbon px-[22px] py-[24px] transition-colors hover:bg-carbon-2"
            >
              <div className="flex items-center justify-between font-display text-[12.5px] font-bold italic uppercase tracking-[0.08em] text-signal">
                <span>{SPORT_LABEL[event.sport_type] ?? event.sport_type}</span>
                <span>{formatDate(event.event_date)}</span>
              </div>
              <h3 className="font-display text-[19px] font-bold uppercase leading-[1.1]">
                {event.name}
              </h3>
              <div className="mt-auto flex items-center justify-between text-[13.5px] text-fog">
                <span>
                  {event.city ? `${event.city}, ` : ""}
                  {event.country_code}
                </span>
                {event.distance_label && (
                  <span className="font-display font-semibold uppercase text-chalk">
                    {event.distance_label}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
