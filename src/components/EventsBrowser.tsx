"use client";

import { useMemo, useState } from "react";
import { SPORT_LABEL } from "@/lib/sportLabels";

export type EventCard = {
  id: string;
  slug: string;
  name: string;
  sport_type: string;
  discipline: string | null;
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

export default function EventsBrowser({ events }: { events: EventCard[] }) {
  const [query, setQuery] = useState("");
  const [sports, setSports] = useState<Set<string>>(new Set());
  const [country, setCountry] = useState("");
  const [includePast, setIncludePast] = useState(false);

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

  function toggleSport(sport: string) {
    setSports((prev) => {
      const next = new Set(prev);
      if (next.has(sport)) next.delete(sport);
      else next.add(sport);
      return next;
    });
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return events.filter((e) => {
      if (!includePast && e.event_date && e.event_date < today) return false;
      if (sports.size > 0 && !sports.has(e.sport_type)) return false;
      if (country && e.country_code !== country) return false;
      if (!q) return true;
      return (
        e.name.toLowerCase().includes(q) ||
        (e.city ?? "").toLowerCase().includes(q)
      );
    });
  }, [events, query, sports, country, includePast, today]);

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
            <div
              key={event.id}
              className="flex flex-col gap-3 bg-carbon px-[22px] py-[24px]"
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
