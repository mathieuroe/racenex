"use client";

import { useMemo, useState, type FormEvent } from "react";
import CustomSelect from "@/components/CustomSelect";
import { SPORT_LABEL, SPORT_ORDER } from "@/lib/sportLabels";

export type WaitlistEvent = {
  slug: string;
  name: string;
  sport_type: string;
  event_date: string | null;
  city: string | null;
  country_code: string | null;
};

const FORMSPREE_ENDPOINT = "https://formspree.io/f/xeebygpe";

function formatEventOptionLabel(event: WaitlistEvent): string {
  const parts: string[] = [event.name];
  if (event.event_date) {
    parts.push(
      new Date(event.event_date).toLocaleDateString("de-DE", {
        day: "2-digit",
        month: "short",
      })
    );
  }
  if (event.city) parts.push(event.city);
  return parts.join(" · ");
}

type Status = "idle" | "submitting" | "success" | "error";

export default function WaitlistForm({ events }: { events: WaitlistEvent[] }) {
  const [email, setEmail] = useState("");
  const [sport, setSport] = useState("");
  const [eventSlug, setEventSlug] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  const sportOptions = SPORT_ORDER.map((key) => ({
    value: key,
    label: SPORT_LABEL[key],
  }));

  const eventsForSport = useMemo(
    () => events.filter((e) => e.sport_type === sport),
    [events, sport]
  );

  const eventOptions = eventsForSport.length
    ? eventsForSport.map((e) => ({ value: e.slug, label: formatEventOptionLabel(e) }))
    : [{ value: "", label: "Noch keine Events — wir sagen Bescheid", disabled: true }];

  function handleSportChange(next: string) {
    setSport(next);
    setEventSlug("");
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email || !email.includes("@")) return;
    if (!sport) return;
    if (eventsForSport.length > 0 && !eventSlug) return;

    setStatus("submitting");

    const chosenEvent = eventsForSport.find((ev) => ev.slug === eventSlug);
    const eventLabel = chosenEvent
      ? formatEventOptionLabel(chosenEvent)
      : `Kein festes Event (${SPORT_LABEL[sport]})`;

    try {
      const res = await fetch(FORMSPREE_ENDPOINT, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, sport: SPORT_LABEL[sport], event: eventLabel }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Senden fehlgeschlagen");
      }

      setMessage(`Notiert: ${eventLabel}. Wir melden uns, sobald der Raum offen ist.`);
      setStatus("success");
    } catch {
      setMessage("Da ging etwas schief — bitte nochmal versuchen.");
      setStatus("error");
    }
  }

  if (status === "success" || status === "error") {
    return (
      <div
        className={`relative mt-8 animate-[pop_0.4s_ease] rounded-xl border-[1.5px] bg-signal/[0.06] px-6 py-[22px] ${
          status === "error" ? "border-[#E0402F]" : "border-signal"
        }`}
      >
        <div className="font-display text-xl font-extrabold italic uppercase text-signal">
          ∥ Du bist dabei
        </div>
        <p className="mt-1.5 text-[14.5px] text-chalk">{message}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="relative mt-8 grid max-w-[520px] gap-3.5">
      <div>
        <label
          htmlFor="email"
          className="mb-2 block font-display text-[12.5px] font-bold italic uppercase tracking-[0.1em] text-signal"
        >
          E-Mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="du@beispiel.de"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-[9px] border-[1.5px] border-line bg-void px-[15px] py-3.5 text-[15.5px] text-chalk transition-colors placeholder:text-[#5A636E] focus:border-signal focus:outline-none"
        />
      </div>

      <CustomSelect
        label="Deine Sportart"
        placeholder="Wähle deine Sportart…"
        value={sport}
        options={sportOptions}
        onChange={handleSportChange}
      />

      <CustomSelect
        label="Dein nächstes Rennen"
        placeholder="Wähle dein Event…"
        value={eventSlug}
        options={eventOptions}
        onChange={setEventSlug}
        disabled={!sport}
      />

      <button
        type="submit"
        disabled={status === "submitting"}
        className="mt-1 rounded-[9px] bg-signal px-4 py-[15px] font-display text-[17px] font-extrabold italic uppercase tracking-[0.03em] text-white transition-colors active:translate-y-px hover:bg-chalk hover:text-void disabled:cursor-not-allowed disabled:opacity-60"
      >
        {status === "submitting" ? "Senden …" : "Auf die Liste ∥ setzen"}
      </button>
      <p className="mt-1.5 text-[13px] text-[#5A636E]">
        Kein Spam. Nur eine Nachricht, wenn dein Event live geht.
      </p>
    </form>
  );
}
