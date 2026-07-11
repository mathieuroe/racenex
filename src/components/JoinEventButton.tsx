"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase-browser";

export default function JoinEventButton({
  athleteId,
  eventId,
  initiallyJoined,
}: {
  athleteId: string;
  eventId: string;
  initiallyJoined: boolean;
}) {
  const router = useRouter();
  const [joined, setJoined] = useState(initiallyJoined);
  const [pending, setPending] = useState(false);

  async function toggle() {
    setPending(true);
    const supabase = createClient();

    if (joined) {
      const { error } = await supabase
        .from("participations")
        .delete()
        .eq("athlete_id", athleteId)
        .eq("event_id", eventId);
      if (!error) setJoined(false);
    } else {
      const { error } = await supabase
        .from("participations")
        .upsert(
          { athlete_id: athleteId, event_id: eventId, status: "interested" },
          { onConflict: "athlete_id,event_id" },
        );
      if (!error) setJoined(true);
    }

    setPending(false);
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      className={
        joined
          ? "shrink-0 rounded-[9px] border-[1.5px] border-signal px-5 py-3.5 font-display text-[15px] font-extrabold italic uppercase tracking-[0.03em] text-signal transition-colors hover:bg-signal/[0.06] disabled:opacity-60"
          : "shrink-0 rounded-[9px] border-[1.5px] border-signal bg-signal px-5 py-3.5 font-display text-[15px] font-extrabold italic uppercase tracking-[0.03em] text-white transition-colors hover:bg-signal-dim disabled:opacity-60"
      }
    >
      {joined ? "✓ Du bist dabei" : "Ich bin dabei"}
    </button>
  );
}
