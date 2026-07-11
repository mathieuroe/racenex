"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import CustomSelect from "@/components/CustomSelect";
import { createClient } from "@/lib/supabase-browser";

export type UpcomingEventOption = {
  id: string;
  name: string;
  event_date: string;
  city: string | null;
};

function formatEventOptionLabel(event: UpcomingEventOption): string {
  const parts: string[] = [event.name];
  parts.push(
    new Date(event.event_date).toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }),
  );
  if (event.city) parts.push(event.city);
  return parts.join(" · ");
}

export default function NextRaceForm({
  athleteId,
  events,
}: {
  athleteId: string;
  events: UpcomingEventOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [eventId, setEventId] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [error, setError] = useState("");

  const eventOptions = events
    .slice()
    .sort((a, b) => a.event_date.localeCompare(b.event_date))
    .map((e) => ({ value: e.id, label: formatEventOptionLabel(e) }));

  async function handleSave() {
    if (!eventId) {
      setError("Wähle ein Rennen aus.");
      setStatus("error");
      return;
    }

    setStatus("saving");
    const supabase = createClient();
    const { error: dbError } = await supabase
      .from("participations")
      .upsert(
        { athlete_id: athleteId, event_id: eventId, status: "registered" },
        { onConflict: "athlete_id,event_id" },
      );

    if (dbError) {
      setError("Speichern fehlgeschlagen — bitte nochmal versuchen.");
      setStatus("error");
      return;
    }

    setOpen(false);
    setStatus("idle");
    router.refresh();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="font-display text-[12.5px] font-bold italic uppercase tracking-[0.08em] text-signal hover:text-chalk"
      >
        + Nächstes Rennen setzen
      </button>
    );
  }

  return (
    <div className="mt-3 grid gap-3 rounded-xl border border-line bg-carbon p-5">
      <CustomSelect
        label="Nächstes Rennen"
        placeholder="Event suchen und auswählen…"
        value={eventId}
        options={eventOptions}
        onChange={setEventId}
        searchable
        searchPlaceholder="z.B. Ironman, Hyrox, Köln…"
      />
      {status === "error" && (
        <p className="text-[13px] text-[#E0402F]">{error}</p>
      )}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={status === "saving"}
          className="rounded-[9px] bg-signal px-4 py-2.5 font-display text-[14px] font-extrabold italic uppercase tracking-[0.03em] text-white transition-colors hover:bg-chalk hover:text-void disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === "saving" ? "Speichern …" : "Speichern"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-[9px] px-4 py-2.5 font-display text-[14px] font-bold italic uppercase tracking-[0.03em] text-fog hover:text-chalk"
        >
          Abbrechen
        </button>
      </div>
    </div>
  );
}
