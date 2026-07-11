import Image from "next/image";
import Link from "next/link";
import AuthNav from "@/components/AuthNav";
import EventsBrowser, { type EventCard } from "@/components/EventsBrowser";
import { supabase } from "@/lib/supabase";

export const revalidate = 0;

export default async function EventsPage() {
  const { data, error } = await supabase
    .from("events")
    .select(
      "id, slug, name, sport_type, discipline, distance_label, event_date, city, country_code",
    )
    .order("event_date", { ascending: true })
    .limit(300);

  const events = (data ?? []) as EventCard[];

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-line bg-void/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1080px] items-center justify-between px-6">
          <Link href="/">
            <Image
              src="/racenex-wordmark-light.png"
              alt="racenex"
              width={398}
              height={116}
              priority
              className="h-[30px] w-auto"
            />
          </Link>
          <div className="flex items-center gap-6">
            <AuthNav />
            <Link
              href="/#join"
              className="-skew-x-[4deg] rounded-md bg-signal px-[18px] py-[9px] font-display text-[15px] font-bold italic uppercase tracking-[0.04em] text-white transition-colors hover:bg-chalk hover:text-void max-[720px]:hidden"
            >
              <span className="inline-block skew-x-[4deg]">
                Früh dabei sein
              </span>
            </Link>
          </div>
        </div>
      </header>

      <main className="px-6 py-14">
        <div className="mx-auto max-w-[1080px]">
          <div className="mb-[22px] flex items-center gap-[10px] font-display text-sm font-bold italic uppercase tracking-[0.14em] text-signal before:font-extrabold before:tracking-[-0.1em] before:content-['∥']">
            Kommende Events
          </div>
          <h1 className="max-w-[20ch] font-display text-[clamp(32px,5vw,56px)] font-extrabold uppercase leading-[0.98] tracking-[-0.015em]">
            Renn-Kalender
          </h1>
          <p className="mt-[18px] max-w-[60ch] text-[15.5px] leading-[1.5] text-fog">
            Anonyme Event-Daten, importiert aus öffentlichen Rennkalendern —
            keine Ergebnisse, keine Teilnehmerlisten. {events.length} Einträge.
          </p>

          {error && (
            <div className="mt-10 rounded-xl border-[1.5px] border-[#E0402F] bg-[#E0402F]/[0.06] px-6 py-5 text-[14.5px] text-chalk">
              Events konnten nicht geladen werden: {error.message}
            </div>
          )}

          {!error && events.length === 0 && (
            <div className="mt-10 rounded-xl border border-line bg-carbon px-6 py-5 text-[14.5px] text-fog">
              Noch keine Events in der Datenbank.
            </div>
          )}

          {events.length > 0 && (
            <div className="mt-10">
              <EventsBrowser events={events} />
            </div>
          )}
        </div>
      </main>

      <footer className="mt-[60px] border-t border-line px-6 py-10">
        <div className="mx-auto flex max-w-[1080px] flex-wrap items-center justify-between gap-4">
          <Image
            src="/racenex-wordmark-light.png"
            alt="racenex"
            width={398}
            height={116}
            className="h-[26px] w-auto opacity-[0.92]"
          />
          <div className="font-display text-[13px] font-semibold italic uppercase tracking-[0.03em] text-[#5A636E]">
            Für die, die am Start stehen · 2026
          </div>
        </div>
      </footer>
    </>
  );
}
