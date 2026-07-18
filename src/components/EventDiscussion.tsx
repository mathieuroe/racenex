"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Avatar from "@/components/Avatar";
import { createClient } from "@/lib/supabase-browser";

export type PostNode = {
  id: string;
  body: string;
  created_at: string;
  athlete: {
    handle: string;
    display_name: string;
    avatar_url: string | null;
  } | null;
  replies: PostNode[];
};

const STARTER_TOPICS = [
  {
    label: "Mitfahrgelegenheit",
    starter: "Sucht jemand eine Mitfahrgelegenheit? Ich starte von ",
  },
  {
    label: "Treffpunkt",
    starter: "Wer will sich vor dem Start treffen? Ich bin so gegen ",
  },
  {
    label: "Pace-Gruppe",
    starter: "Wer läuft ungefähr mein Tempo? Ich peile eine Zielzeit von ",
  },
  {
    label: "Unterkunft",
    starter: "Hat jemand Tipps für Unterkünfte in der Nähe? ",
  },
  { label: "Wetter", starter: "Wie sieht's mit dem Wetter am Renntag aus? " },
];

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Reply({ post }: { post: PostNode }) {
  return (
    <div className="flex gap-2.5 pl-[52px]">
      <Avatar
        name={post.athlete?.display_name ?? "?"}
        avatarUrl={post.athlete?.avatar_url ?? null}
        size={26}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <Link
            href={post.athlete ? `/@${post.athlete.handle}` : "#"}
            className="font-display text-[12.5px] font-bold uppercase text-chalk hover:text-signal"
          >
            {post.athlete?.display_name ?? "Gelöscht"}
          </Link>
          <span className="text-[11px] text-fog">
            {formatTimestamp(post.created_at)}
          </span>
        </div>
        <p className="mt-0.5 text-[13.5px] leading-[1.45] text-chalk">
          {post.body}
        </p>
      </div>
    </div>
  );
}

export default function EventDiscussion({
  eventId,
  viewerAthleteId,
  posts,
}: {
  eventId: string;
  viewerAthleteId: string | null;
  posts: PostNode[];
}) {
  const router = useRouter();
  const [newPost, setNewPost] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [pending, setPending] = useState(false);

  async function submitPost() {
    if (!viewerAthleteId || !newPost.trim()) return;
    setPending(true);
    const supabase = createClient();
    const { error } = await supabase.from("posts").insert({
      event_id: eventId,
      athlete_id: viewerAthleteId,
      body: newPost.trim(),
    });
    setPending(false);
    if (!error) {
      setNewPost("");
      router.refresh();
    }
  }

  async function submitReply(parentId: string) {
    if (!viewerAthleteId || !replyBody.trim()) return;
    setPending(true);
    const supabase = createClient();
    const { error } = await supabase.from("posts").insert({
      event_id: eventId,
      athlete_id: viewerAthleteId,
      parent_id: parentId,
      body: replyBody.trim(),
    });
    setPending(false);
    if (!error) {
      setReplyBody("");
      setReplyingTo(null);
      router.refresh();
    }
  }

  return (
    <div>
      {viewerAthleteId && (
        <div className="mb-5">
          <div className="mb-2 flex flex-wrap gap-1.5">
            {STARTER_TOPICS.map((topic) => (
              <button
                key={topic.label}
                type="button"
                onClick={() => setNewPost(topic.starter)}
                className="rounded-full border border-line px-3 py-1 text-[12px] font-medium text-fog transition-colors hover:border-signal hover:text-signal"
              >
                {topic.label}
              </button>
            ))}
          </div>
          <div className="flex gap-3">
            <textarea
              value={newPost}
              onChange={(e) => setNewPost(e.target.value)}
              placeholder="Frag was, oder such Mitfahrer für dieses Rennen…"
              rows={2}
              className="w-full resize-none rounded-[9px] border-[1.5px] border-line bg-void px-[15px] py-3 text-[14.5px] text-chalk transition-colors placeholder:text-[#5A636E] focus:border-signal focus:outline-none"
            />
            <button
              type="button"
              onClick={submitPost}
              disabled={pending || !newPost.trim()}
              className="shrink-0 self-end rounded-[9px] bg-signal px-4 py-3 font-display text-[13px] font-extrabold italic uppercase tracking-[0.03em] text-white transition-colors hover:bg-signal-dim disabled:cursor-not-allowed disabled:opacity-60"
            >
              Posten
            </button>
          </div>
        </div>
      )}

      {posts.length === 0 ? (
        <div className="rounded-xl border border-line bg-carbon px-6 py-8 text-center text-[14.5px] text-fog">
          Noch nichts los hier — stell die erste Frage.
        </div>
      ) : (
        <div className="grid gap-5">
          {posts.map((post) => (
            <div
              key={post.id}
              className="rounded-xl border border-line bg-carbon p-5"
            >
              <div className="flex gap-2.5">
                <Avatar
                  name={post.athlete?.display_name ?? "?"}
                  avatarUrl={post.athlete?.avatar_url ?? null}
                  size={32}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <Link
                      href={post.athlete ? `/@${post.athlete.handle}` : "#"}
                      className="font-display text-[13.5px] font-bold uppercase text-chalk hover:text-signal"
                    >
                      {post.athlete?.display_name ?? "Gelöscht"}
                    </Link>
                    <span className="text-[11.5px] text-fog">
                      {formatTimestamp(post.created_at)}
                    </span>
                  </div>
                  <p className="mt-1 text-[14.5px] leading-[1.45] text-chalk">
                    {post.body}
                  </p>
                </div>
              </div>

              {post.replies.length > 0 && (
                <div className="mt-4 grid gap-3">
                  {post.replies.map((reply) => (
                    <Reply key={reply.id} post={reply} />
                  ))}
                </div>
              )}

              {viewerAthleteId && (
                <div className="mt-3 pl-[42px]">
                  {replyingTo === post.id ? (
                    <div className="flex gap-2">
                      <input
                        value={replyBody}
                        onChange={(e) => setReplyBody(e.target.value)}
                        placeholder="Antworten…"
                        className="w-full rounded-[8px] border-[1.5px] border-line bg-void px-3 py-2 text-[13.5px] text-chalk transition-colors placeholder:text-[#5A636E] focus:border-signal focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => submitReply(post.id)}
                        disabled={pending || !replyBody.trim()}
                        className="shrink-0 rounded-[8px] bg-signal px-3 py-2 font-display text-[12px] font-bold uppercase text-white disabled:opacity-60"
                      >
                        ✓
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setReplyingTo(null);
                          setReplyBody("");
                        }}
                        className="shrink-0 text-[12px] text-fog hover:text-chalk"
                      >
                        Abbrechen
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setReplyingTo(post.id)}
                      className="text-[12.5px] font-medium text-fog hover:text-signal"
                    >
                      Antworten
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
