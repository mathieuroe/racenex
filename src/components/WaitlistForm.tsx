"use client";

import { useState, type FormEvent } from "react";

const EVENTS = [
  "Ironman 70.3 Venice 2027",
  "Hyrox München (Winter 2026)",
  "Marathon (München / Frankfurt / Berlin)",
  "Halbmarathon (Herbst 2026)",
  "Ironman 70.3 Luxembourg",
  "Anderes / mehrere",
];

const FORMSPREE_ENDPOINT = "https://formspree.io/f/xeebygpe";

const SELECT_ARROW =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%231B3A8F' stroke-width='3'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")";

type Status = "idle" | "submitting" | "success" | "error";

export default function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [event, setEvent] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email || !email.includes("@")) return;
    if (!event) return;

    setStatus("submitting");

    try {
      const res = await fetch(FORMSPREE_ENDPOINT, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, event }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Senden fehlgeschlagen");
      }

      setMessage(`Notiert: ${event}. Wir melden uns, sobald der Raum offen ist.`);
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
      <div>
        <label
          htmlFor="event"
          className="mb-2 block font-display text-[12.5px] font-bold italic uppercase tracking-[0.1em] text-signal"
        >
          Dein nächstes Rennen
        </label>
        <select
          id="event"
          name="event"
          required
          value={event}
          onChange={(e) => setEvent(e.target.value)}
          style={{ backgroundImage: SELECT_ARROW }}
          className="w-full cursor-pointer appearance-none rounded-[9px] border-[1.5px] border-line bg-void bg-no-repeat px-[15px] py-3.5 text-[15.5px] text-chalk transition-colors focus:border-signal focus:outline-none [background-position:right_15px_center]"
        >
          <option value="" disabled>
            Wähle dein Event…
          </option>
          {EVENTS.map((ev) => (
            <option key={ev} value={ev}>
              {ev}
            </option>
          ))}
        </select>
      </div>
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
