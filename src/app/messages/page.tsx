import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import Avatar from "@/components/Avatar";
import { supabase } from "@/lib/supabase";
import { createClient } from "@/lib/supabase-server";

export const revalidate = 0;

type AthleteRef = {
  handle: string;
  display_name: string;
  avatar_url: string | null;
};

type RawMessage = {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
  sender: AthleteRef | null;
  recipient: AthleteRef | null;
};

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "short",
  });
}

export default async function MessagesInboxPage() {
  const authed = await createClient();
  const {
    data: { user },
  } = await authed.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: viewerAthlete } = await supabase
    .from("athletes")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!viewerAthlete) {
    redirect("/profile");
  }

  const { data: rows } = await authed
    .from("messages")
    .select(
      "id, sender_id, recipient_id, body, created_at, read_at, sender:athletes!messages_sender_id_fkey(handle, display_name, avatar_url), recipient:athletes!messages_recipient_id_fkey(handle, display_name, avatar_url)",
    )
    .or(`sender_id.eq.${viewerAthlete.id},recipient_id.eq.${viewerAthlete.id}`)
    .order("created_at", { ascending: false });

  const messages = (rows ?? []) as unknown as RawMessage[];

  type Conversation = {
    otherId: string;
    other: AthleteRef;
    lastBody: string;
    lastAt: string;
    unread: number;
  };

  const conversations = new Map<string, Conversation>();
  for (const m of messages) {
    const isMine = m.sender_id === viewerAthlete.id;
    const otherId = isMine ? m.recipient_id : m.sender_id;
    const other = isMine ? m.recipient : m.sender;
    if (!other) continue;

    const existing = conversations.get(otherId);
    if (!existing) {
      conversations.set(otherId, {
        otherId,
        other,
        lastBody: m.body,
        lastAt: m.created_at,
        unread: !isMine && !m.read_at ? 1 : 0,
      });
    } else if (!isMine && !m.read_at) {
      existing.unread += 1;
    }
  }

  const conversationList = Array.from(conversations.values());

  return (
    <>
      <header className="border-b border-line bg-void/85 backdrop-blur-md">
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
        </div>
      </header>

      <main className="px-6 py-14">
        <div className="mx-auto max-w-[560px]">
          <div className="mb-[18px] flex items-center gap-[10px] font-display text-sm font-bold italic uppercase tracking-[0.14em] text-signal before:font-extrabold before:tracking-[-0.1em] before:content-['∥']">
            Nachrichten
          </div>
          <h1 className="font-display text-[clamp(28px,5vw,40px)] font-extrabold uppercase leading-[0.98] tracking-[-0.015em]">
            Deine Konversationen
          </h1>

          {conversationList.length === 0 ? (
            <div className="mt-8 rounded-xl border border-line bg-carbon px-6 py-10 text-center text-[14.5px] text-fog">
              Noch keine Nachrichten. Schreib jemandem über sein Profil an.
            </div>
          ) : (
            <div className="mt-8 grid gap-px overflow-hidden rounded-[14px] border border-line bg-line">
              {conversationList.map((c) => (
                <Link
                  key={c.otherId}
                  href={`/messages/${c.other.handle}`}
                  className="flex items-center gap-3 bg-carbon px-5 py-4 transition-colors hover:bg-carbon-2"
                >
                  <Avatar
                    name={c.other.display_name}
                    avatarUrl={c.other.avatar_url}
                    size={40}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-display text-[14.5px] font-bold uppercase">
                        {c.other.display_name}
                      </span>
                      <span className="shrink-0 text-[12px] text-fog">
                        {formatTimestamp(c.lastAt)}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-[13px] text-fog">
                      {c.lastBody}
                    </p>
                  </div>
                  {c.unread > 0 && (
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-signal text-[11px] font-bold text-white">
                      {c.unread}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
