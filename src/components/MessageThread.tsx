"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase-browser";

export type MessageRow = {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString("de-DE", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MessageThread({
  viewerAthleteId,
  otherAthleteId,
  messages,
}: {
  viewerAthleteId: string;
  otherAthleteId: string;
  messages: MessageRow[];
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!body.trim()) return;
    setPending(true);
    const supabase = createClient();
    const { error } = await supabase.from("messages").insert({
      sender_id: viewerAthleteId,
      recipient_id: otherAthleteId,
      body: body.trim(),
    });
    setPending(false);
    if (!error) {
      setBody("");
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col">
      <div className="grid gap-3">
        {messages.length === 0 ? (
          <p className="py-8 text-center text-[14px] text-fog">
            Noch keine Nachrichten — schreib die erste.
          </p>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === viewerAthleteId;
            return (
              <div
                key={m.id}
                className={`flex ${mine ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={
                    mine
                      ? "max-w-[75%] rounded-[14px] rounded-br-[4px] bg-signal px-4 py-2.5 text-white"
                      : "max-w-[75%] rounded-[14px] rounded-bl-[4px] border border-line bg-carbon px-4 py-2.5 text-chalk"
                  }
                >
                  <p className="text-[14.5px] leading-[1.4] whitespace-pre-wrap">
                    {m.body}
                  </p>
                  <div
                    className={`mt-1 text-[10.5px] ${mine ? "text-white/70" : "text-fog"}`}
                  >
                    {formatTimestamp(m.created_at)}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        className="sticky bottom-0 mt-6 flex gap-3 bg-void pt-3"
      >
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Nachricht schreiben…"
          className="w-full rounded-[9px] border-[1.5px] border-line bg-carbon px-[15px] py-3.5 text-[14.5px] text-chalk transition-colors placeholder:text-[#5A636E] focus:border-signal focus:outline-none"
        />
        <button
          type="submit"
          disabled={pending || !body.trim()}
          className="shrink-0 rounded-[9px] bg-signal px-5 py-3.5 font-display text-[14px] font-extrabold italic uppercase tracking-[0.03em] text-white transition-colors hover:bg-signal-dim disabled:cursor-not-allowed disabled:opacity-60"
        >
          Senden
        </button>
      </form>
    </div>
  );
}
