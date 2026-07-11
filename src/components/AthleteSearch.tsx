"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import Avatar from "@/components/Avatar";

export type AthleteCard = {
  handle: string;
  display_name: string;
  home_city: string | null;
  country_code: string | null;
  age_group: string | null;
  avatar_url: string | null;
};

export default function AthleteSearch({
  athletes,
  viewerHomeCity,
}: {
  athletes: AthleteCard[];
  viewerHomeCity: string | null;
}) {
  const [query, setQuery] = useState("");
  const [nearbyOnly, setNearbyOnly] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return athletes.filter((a) => {
      if (nearbyOnly && a.home_city !== viewerHomeCity) return false;
      if (!q) return true;
      return (
        a.display_name.toLowerCase().includes(q) ||
        a.handle.toLowerCase().includes(q) ||
        (a.home_city ?? "").toLowerCase().includes(q)
      );
    });
  }, [athletes, query, nearbyOnly, viewerHomeCity]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Name, Handle oder Stadt suchen…"
          className="min-w-0 flex-1 rounded-[9px] border-[1.5px] border-line bg-void px-[15px] py-3.5 text-[15.5px] text-chalk transition-colors placeholder:text-[#5A636E] focus:border-signal focus:outline-none"
        />
        {viewerHomeCity && (
          <button
            type="button"
            onClick={() => setNearbyOnly((v) => !v)}
            className={
              nearbyOnly
                ? "shrink-0 rounded-[9px] border-[1.5px] border-signal bg-signal px-4 py-3.5 font-display text-[13px] font-bold italic uppercase tracking-[0.04em] text-white"
                : "shrink-0 rounded-[9px] border-[1.5px] border-line bg-carbon px-4 py-3.5 font-display text-[13px] font-bold italic uppercase tracking-[0.04em] text-fog hover:border-signal hover:text-signal"
            }
          >
            In meiner Nähe
          </button>
        )}
      </div>

      <p className="mt-3 text-[13px] text-fog">
        {filtered.length} {filtered.length === 1 ? "Athlet" : "Athleten"}
      </p>

      {filtered.length === 0 ? (
        <div className="mt-6 rounded-xl border border-line bg-carbon px-6 py-10 text-center text-[14.5px] text-fog">
          Niemand gefunden.
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-px overflow-hidden rounded-[14px] border border-line bg-line sm:grid-cols-2">
          {filtered.map((a) => (
            <Link
              key={a.handle}
              href={`/@${a.handle}`}
              className="flex items-center gap-4 bg-carbon px-5 py-4 transition-colors hover:bg-carbon-2"
            >
              <Avatar
                name={a.display_name}
                avatarUrl={a.avatar_url}
                size={48}
              />
              <div className="min-w-0">
                <div className="truncate font-display text-[15px] font-bold uppercase leading-tight">
                  {a.display_name}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12.5px] text-fog">
                  <span>@{a.handle}</span>
                  {a.home_city && <span>· {a.home_city}</span>}
                  {a.age_group && (
                    <span className="text-signal">{a.age_group}</span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
