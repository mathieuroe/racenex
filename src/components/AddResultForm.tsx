"use client";

import { useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import CustomSelect from "@/components/CustomSelect";
import { createClient } from "@/lib/supabase-browser";
import { parseRaceTime } from "@/lib/raceTime";
import { SPORT_LABEL, SPORT_ORDER } from "@/lib/sportLabels";

export type ResultEventOption = {
  id: string;
  name: string;
  sport_type: string;
  event_date: string | null;
  city: string | null;
};

function formatEventOptionLabel(event: ResultEventOption): string {
  const parts: string[] = [event.name];
  if (event.event_date) {
    parts.push(
      new Date(event.event_date).toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" })
    );
  }
  if (event.city) parts.push(event.city);
  return parts.join(" · ");
}

export default function AddResultForm({
  athleteId,
  events,
}: {
  athleteId: string;
  events: ResultEventOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [eventId, setEventId] = useState("");
  const [manualMode, setManualMode] = useState(false);
  const [manualEventLabel, setManualEventLabel] = useState("");
  const [manualEventDate, setManualEventDate] = useState("");
  const [manualSportType, setManualSportType] = useState("");
  const [finishTime, setFinishTime] = useState("");
  const [officialUrl, setOfficialUrl] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [error, setError] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  const eventsById = useMemo(() => new Map(events.map((e) => [e.id, e])), [events]);
  const selectedEvent = eventsById.get(eventId);

  const eventOptions = events
    .slice()
    .sort((a, b) => (b.event_date ?? "").localeCompare(a.event_date ?? ""))
    .map((e) => ({ value: e.id, label: formatEventOptionLabel(e) }));

  function resetForm() {
    setEventId("");
    setManualMode(false);
    setManualEventLabel("");
    setManualEventDate("");
    setManualSportType("");
    setFinishTime("");
    setOfficialUrl("");
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const eventLabel = manualMode ? manualEventLabel.trim() : selectedEvent?.name ?? "";
    const eventDate = manualMode ? manualEventDate : selectedEvent?.event_date ?? "";
    const sportType = manualMode ? manualSportType : selectedEvent?.sport_type ?? "";

    if (!eventLabel || !eventDate || !sportType) {
      setError(
        manualMode
          ? "Rennen, Datum und Sportart sind Pflicht."
          : "Wähle ein Rennen aus der Liste."
      );
      setStatus("error");
      return;
    }
    const finishSec = finishTime.trim() ? parseRaceTime(finishTime.trim()) : null;
    if (finishTime.trim() && finishSec === null) {
      setError("Zeit im Format h:mm:ss oder mm:ss eingeben, z.B. 4:32:10.");
      setStatus("error");
      return;
    }

    setStatus("saving");
    const supabase = createClient();
    const { error: dbError } = await supabase.from("results").insert({
      athlete_id: athleteId,
      event_id: manualMode ? null : eventId,
      event_label: eventLabel,
      event_date: eventDate,
      sport_type: sportType,
      finish_time_sec: finishSec,
      official_url: officialUrl.trim() || null,
      source: "claimed",
    });

    if (dbError) {
      setError("Speichern fehlgeschlagen — bitte nochmal versuchen.");
      setStatus("error");
      return;
    }

    resetForm();
    setOpen(false);
    setStatus("idle");
    router.refresh();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-[9px] border-[1.5px] border-signal px-4 py-2.5 font-display text-[13.5px] font-bold italic uppercase tracking-[0.05em] text-signal transition-colors hover:bg-signal hover:text-white"
      >
        + Ergebnis hinzufügen
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      noValidate
      className="grid gap-3.5 rounded-xl border border-line bg-carbon p-6"
    >
      {!manualMode ? (
        <>
          <CustomSelect
            label="Rennen"
            placeholder="Event suchen und auswählen…"
            value={eventId}
            options={eventOptions}
            onChange={setEventId}
            searchable
            searchPlaceholder="z.B. Ironman, Hyrox, Köln…"
          />
          <button
            type="button"
            onClick={() => setManualMode(true)}
            className="justify-self-start text-[13px] text-fog underline decoration-dotted hover:text-signal"
          >
            Mein Rennen ist nicht dabei
          </button>
        </>
      ) : (
        <>
          <div>
            <label
              htmlFor="manual_event_label"
              className="mb-2 block font-display text-[12.5px] font-bold italic uppercase tracking-[0.1em] text-signal"
            >
              Rennen
            </label>
            <input
              id="manual_event_label"
              value={manualEventLabel}
              onChange={(e) => setManualEventLabel(e.target.value)}
              placeholder="Name des Rennens"
              className="w-full rounded-[9px] border-[1.5px] border-line bg-void px-[15px] py-3.5 text-[15.5px] text-chalk transition-colors placeholder:text-[#5A636E] focus:border-signal focus:outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3.5">
            <div>
              <label
                htmlFor="manual_event_date"
                className="mb-2 block font-display text-[12.5px] font-bold italic uppercase tracking-[0.1em] text-signal"
              >
                Datum
              </label>
              <input
                id="manual_event_date"
                type="date"
                value={manualEventDate}
                onChange={(e) => setManualEventDate(e.target.value)}
                className="w-full rounded-[9px] border-[1.5px] border-line bg-void px-[15px] py-3.5 text-[15.5px] text-chalk transition-colors focus:border-signal focus:outline-none"
              />
            </div>
            <CustomSelect
              label="Sportart"
              placeholder="Wähle…"
              value={manualSportType}
              options={SPORT_ORDER.map((key) => ({ value: key, label: SPORT_LABEL[key] }))}
              onChange={setManualSportType}
            />
          </div>
          <button
            type="button"
            onClick={() => setManualMode(false)}
            className="justify-self-start text-[13px] text-fog underline decoration-dotted hover:text-signal"
          >
            Doch aus der Liste wählen
          </button>
        </>
      )}

      <div>
        <label
          htmlFor="finish_time"
          className="mb-2 block font-display text-[12.5px] font-bold italic uppercase tracking-[0.1em] text-signal"
        >
          Zeit (h:mm:ss)
        </label>
        <input
          id="finish_time"
          value={finishTime}
          onChange={(e) => setFinishTime(e.target.value)}
          placeholder="4:32:10"
          className="w-full rounded-[9px] border-[1.5px] border-line bg-void px-[15px] py-3.5 text-[15.5px] text-chalk transition-colors placeholder:text-[#5A636E] focus:border-signal focus:outline-none"
        />
      </div>

      <div>
        <label
          htmlFor="official_url"
          className="mb-2 block font-display text-[12.5px] font-bold italic uppercase tracking-[0.1em] text-signal"
        >
          Link zur offiziellen Ergebnisliste (optional)
        </label>
        <input
          id="official_url"
          type="url"
          value={officialUrl}
          onChange={(e) => setOfficialUrl(e.target.value)}
          placeholder="https://..."
          className="w-full rounded-[9px] border-[1.5px] border-line bg-void px-[15px] py-3.5 text-[15.5px] text-chalk transition-colors placeholder:text-[#5A636E] focus:border-signal focus:outline-none"
        />
      </div>

      {status === "error" && <p className="text-[13.5px] text-[#E0402F]">{error}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={status === "saving"}
          className="rounded-[9px] bg-signal px-4 py-3 font-display text-[15px] font-extrabold italic uppercase tracking-[0.03em] text-white transition-colors hover:bg-chalk hover:text-void disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === "saving" ? "Speichern …" : "Speichern"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-[9px] px-4 py-3 font-display text-[15px] font-bold italic uppercase tracking-[0.03em] text-fog transition-colors hover:text-chalk"
        >
          Abbrechen
        </button>
      </div>
    </form>
  );
}
