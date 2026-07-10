import Image from "next/image";
import type { ReactNode } from "react";
import WaitlistForm from "@/components/WaitlistForm";
import AuthNav from "@/components/AuthNav";
import { supabase } from "@/lib/supabase";

export const revalidate = 0;

const SPLITS = [
  {
    idx: "01",
    title: (
      <>
        Ein Profil,
        <br />
        alle Sportarten
      </>
    ),
    body: "Ironman, Hyrox, Halbmarathon — deine komplette Wettkampf-Historie an einem Ort, statt in fünf getrennten Ergebnisportalen verstreut.",
  },
  {
    idx: "02",
    title: (
      <>
        Der Raum zu
        <br />
        deinem Rennen
      </>
    ),
    body: "Jedes Event hat seinen Ort: Kurs-Stats aus den Vorjahren, Zeiten, und die Leute, die dieses Jahr am Start stehen. Fragen stellen, Antworten von denen, die es wissen.",
  },
  {
    idx: "03",
    title: (
      <>
        Antworten mit
        <br />
        Leistungs-Gesicht
      </>
    ),
    body: "Kein anonymes Forum. Wer dir Pacing-Tipps gibt, dessen Zeiten stehen daneben. Du weißt sofort, wessen Rat zählt.",
  },
];

const CHIPS: { pre: string; bold: ReactNode }[] = [
  { pre: "Startzeiten & ", bold: "Kursanalyse" },
  { pre: "Wer ist ", bold: "am Start" },
  { pre: "Bestzeiten ", bold: "& Splits" },
  { pre: "", bold: "Verifizierte Ergebnisse" },
];

export default async function Home() {
  const { data } = await supabase
    .from("events")
    .select("slug, name, sport_type, event_date, city, country_code")
    .order("event_date", { ascending: true })
    .limit(200);

  const events = data ?? [];

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-line bg-void/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1080px] items-center justify-between px-6">
          <Image
            src="/racenex-wordmark-light.png"
            alt="racenex"
            width={398}
            height={116}
            priority
            className="h-[30px] w-auto"
          />
          <div className="flex items-center gap-6">
            <AuthNav />
            <a
              href="#join"
              className="-skew-x-[4deg] rounded-md bg-signal px-[18px] py-[9px] font-display text-[15px] font-bold italic uppercase tracking-[0.04em] text-white transition-colors hover:bg-chalk hover:text-void max-[720px]:hidden"
            >
              <span className="inline-block skew-x-[4deg]">Früh dabei sein</span>
            </a>
          </div>
        </div>
      </header>

      <main>
        <section className="relative px-6 pb-12 pt-14 md:pb-[72px] md:pt-[88px]">
          <div className="mx-auto max-w-[1080px]">
            <div className="mb-[22px] flex items-center gap-[10px] font-display text-sm font-bold italic uppercase tracking-[0.14em] text-signal before:font-extrabold before:tracking-[-0.1em] before:content-['∥']">
              Triathlon · Hyrox · Marathon — an einem Ort
            </div>
            <h1 className="max-w-[16ch] font-display text-[clamp(44px,8vw,88px)] font-extrabold uppercase leading-[0.96] tracking-[-0.015em]">
              Dein nächstes Rennen. Deine Leute.{" "}
              <em className="text-signal italic">Deine Zeiten.</em>
            </h1>
            <p className="mt-[26px] max-w-[52ch] text-[clamp(17px,2.2vw,21px)] leading-[1.5] text-fog">
              Für alle, die auf ein Ziel hintrainieren. Die Plattform racenex
              bündelt jedes Rennen, das du gemacht hast — sportartübergreifend
              — und verbindet dich mit den Leuten, die{" "}
              <b className="font-semibold text-chalk">
                mit dir am selben Start stehen.
              </b>
            </p>

            <div className="mt-16 grid grid-cols-1 gap-px overflow-hidden rounded-[14px] border border-line bg-line md:grid-cols-3">
              {SPLITS.map((split) => (
                <div key={split.idx} className="bg-carbon px-[26px] py-[30px]">
                  <div className="mb-4 font-display text-[15px] font-extrabold italic tracking-[-0.04em] text-signal">
                    ∥ {split.idx}
                  </div>
                  <h3 className="mb-[10px] font-display text-[22px] font-bold uppercase leading-[1.05] tracking-[0.01em]">
                    {split.title}
                  </h3>
                  <p className="text-[14.5px] leading-[1.5] text-fog">
                    {split.body}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-16 flex flex-wrap items-center justify-center gap-10 border-y border-line py-[26px]">
              {CHIPS.map((chip, i) => (
                <span
                  key={i}
                  className="flex items-center gap-[9px] font-display text-[15px] font-bold italic uppercase tracking-[0.03em] text-fog before:font-extrabold before:text-signal before:tracking-[-0.1em] before:content-['∥']"
                >
                  {chip.pre}
                  <b className="font-bold text-chalk">{chip.bold}</b>
                </span>
              ))}
            </div>
          </div>
        </section>

        <section id="join" className="px-6 pb-10 pt-24">
          <div className="mx-auto max-w-[1080px]">
            <div className="relative overflow-hidden rounded-[20px] border border-line bg-gradient-to-b from-white to-[#F7F9FB] p-[clamp(30px,5vw,56px)] shadow-[0_1px_3px_rgba(12,17,22,0.04)]">
              <div
                aria-hidden
                className="pointer-events-none absolute -top-[30px] right-6 select-none font-display text-[150px] font-extrabold italic leading-none tracking-[-0.06em] text-signal opacity-[0.06]"
              >
                ∥∥∥
              </div>
              <h2 className="relative max-w-[18ch] font-display text-[clamp(30px,5vw,50px)] font-extrabold uppercase leading-[0.98] tracking-[-0.01em]">
                Wenn dein nächstes Rennen einen Raum verdient.
              </h2>
              <p className="relative mt-4 max-w-[46ch] text-[16.5px] text-fog">
                racenex startet mit einer Handvoll Events. Sag uns, worauf du
                hintrainierst — wir melden uns, sobald dein Raum offen ist.
              </p>
              <WaitlistForm events={events} />
            </div>
          </div>
        </section>
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
