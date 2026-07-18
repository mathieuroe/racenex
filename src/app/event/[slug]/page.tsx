import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import Avatar from "@/components/Avatar";
import EventDiscussion, { type PostNode } from "@/components/EventDiscussion";
import JoinEventButton from "@/components/JoinEventButton";
import { supabase } from "@/lib/supabase";
import { createClient } from "@/lib/supabase-server";
import { formatRaceTime } from "@/lib/raceTime";
import { SPORT_LABEL } from "@/lib/sportLabels";

export const revalidate = 0;

function formatDate(iso: string | null): string {
  if (!iso) return "Datum offen";
  return new Date(iso).toLocaleDateString("de-DE", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const { data: event } = await supabase
    .from("events")
    .select(
      "id, slug, name, sport_type, discipline, distance_label, event_date, city, country_code, is_activated, activation_threshold",
    )
    .eq("slug", slug)
    .maybeSingle();

  if (!event) {
    notFound();
  }

  const authed = await createClient();
  const {
    data: { user },
  } = await authed.auth.getUser();

  const { data: viewerAthlete } = user
    ? await supabase
        .from("athletes")
        .select("id")
        .eq("auth_user_id", user.id)
        .maybeSingle()
    : { data: null };

  const { data: participants } = await supabase
    .from("participations")
    .select("athletes(handle, display_name, avatar_url)")
    .eq("event_id", event.id)
    .limit(24);

  const participantRows = (participants ?? [])
    .map(
      (p) =>
        p.athletes as unknown as {
          handle: string;
          display_name: string;
          avatar_url: string | null;
        },
    )
    .filter(Boolean);

  const { data: viewerParticipation } = viewerAthlete
    ? await supabase
        .from("participations")
        .select("athlete_id")
        .eq("athlete_id", viewerAthlete.id)
        .eq("event_id", event.id)
        .maybeSingle()
    : { data: null };

  const { data: results } = await supabase
    .from("results")
    .select(
      "id, finish_time_sec, official_url, athletes(handle, display_name, avatar_url)",
    )
    .eq("event_id", event.id)
    .order("finish_time_sec", { ascending: true, nullsFirst: false })
    .limit(50);

  const resultRows = (results ?? []) as unknown as {
    id: string;
    finish_time_sec: number | null;
    official_url: string | null;
    athletes: {
      handle: string;
      display_name: string;
      avatar_url: string | null;
    } | null;
  }[];

  const threshold = event.activation_threshold ?? 20;
  const progress = Math.min(participantRows.length / threshold, 1);

  const { data: statsRows } = await supabase
    .from("event_stats")
    .select(
      "year, finisher_count, avg_finish_sec, median_finish_sec, best_finish_sec, distribution, ag_distribution",
    )
    .eq("event_id", event.id)
    .order("year", { ascending: false })
    .limit(1);

  const stats = (statsRows?.[0] ?? null) as {
    year: number;
    finisher_count: number;
    avg_finish_sec: number | null;
    median_finish_sec: number | null;
    best_finish_sec: number | null;
    distribution: { from_sec: number; to_sec: number; count: number }[] | null;
    ag_distribution: { ag: string; count: number; median_sec: number }[] | null;
  } | null;

  const maxBucketCount = stats?.distribution?.length
    ? Math.max(...stats.distribution.map((b) => b.count))
    : 0;
  const maxAgCount = stats?.ag_distribution?.length
    ? Math.max(...stats.ag_distribution.map((a) => a.count))
    : 0;

  const { data: postRows } = event.is_activated
    ? await supabase
        .from("posts")
        .select(
          "id, parent_id, body, created_at, athletes(handle, display_name, avatar_url)",
        )
        .eq("event_id", event.id)
        .order("created_at", { ascending: true })
    : { data: null };

  type RawPost = {
    id: string;
    parent_id: string | null;
    body: string;
    created_at: string;
    athletes: {
      handle: string;
      display_name: string;
      avatar_url: string | null;
    } | null;
  };

  const rawPosts = (postRows ?? []) as unknown as RawPost[];
  const postMap = new Map<string, PostNode>(
    rawPosts.map((p) => [
      p.id,
      {
        id: p.id,
        body: p.body,
        created_at: p.created_at,
        athlete: p.athletes,
        replies: [],
      },
    ]),
  );
  const topLevelPosts: PostNode[] = [];
  for (const p of rawPosts) {
    const node = postMap.get(p.id)!;
    if (p.parent_id && postMap.has(p.parent_id)) {
      postMap.get(p.parent_id)!.replies.push(node);
    } else if (!p.parent_id) {
      topLevelPosts.push(node);
    }
  }
  topLevelPosts.reverse();

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
          <Link
            href="/events"
            className="font-display text-[13px] font-bold italic uppercase tracking-[0.08em] text-signal hover:text-chalk"
          >
            ← Alle Events
          </Link>
        </div>
      </header>

      <main className="px-6 py-16">
        <div className="mx-auto max-w-[720px]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="mb-[14px] flex items-center gap-[10px] font-display text-sm font-bold italic uppercase tracking-[0.14em] text-signal before:font-extrabold before:tracking-[-0.1em] before:content-['∥']">
                {SPORT_LABEL[event.sport_type] ?? event.sport_type}
                {event.distance_label && (
                  <span className="text-fog">· {event.distance_label}</span>
                )}
              </div>
              <h1 className="font-display text-[clamp(28px,5vw,44px)] font-extrabold uppercase leading-[0.98] tracking-[-0.015em]">
                {event.name}
              </h1>
              <p className="mt-3 text-[15px] text-fog">
                {formatDate(event.event_date)}
                {event.city ? ` · ${event.city}` : ""}
                {event.country_code ? `, ${event.country_code}` : ""}
              </p>
            </div>

            {viewerAthlete && (
              <JoinEventButton
                athleteId={viewerAthlete.id}
                eventId={event.id}
                initiallyJoined={!!viewerParticipation}
              />
            )}
          </div>

          <div className="mt-10 rounded-xl border border-line bg-carbon p-6">
            <div className="flex items-center justify-between">
              <div className="font-display text-[13px] font-bold italic uppercase tracking-[0.06em] text-signal">
                {participantRows.length}{" "}
                {participantRows.length === 1 ? "Athlet" : "Athleten"} dabei
              </div>
              {!event.is_activated && (
                <div className="text-[12.5px] text-fog">
                  noch {Math.max(threshold - participantRows.length, 0)} bis zum
                  Community-Raum
                </div>
              )}
            </div>

            {!event.is_activated && (
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-line">
                <div
                  className="h-full rounded-full bg-signal transition-[width]"
                  style={{ width: `${progress * 100}%` }}
                />
              </div>
            )}

            {participantRows.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-3">
                {participantRows.map((p) => (
                  <Link
                    key={p.handle}
                    href={`/@${p.handle}`}
                    className="flex items-center gap-2 rounded-full border border-line bg-void py-1 pl-1 pr-3 transition-colors hover:border-signal"
                  >
                    <Avatar
                      name={p.display_name}
                      avatarUrl={p.avatar_url}
                      size={26}
                    />
                    <span className="text-[12.5px] font-medium text-chalk">
                      {p.display_name}
                    </span>
                  </Link>
                ))}
              </div>
            )}

            {participantRows.length === 0 && (
              <p className="mt-3 text-[14px] text-fog">
                Noch niemand dabei — sei der Erste, der sich einträgt.
              </p>
            )}
          </div>

          {stats && (
            <div className="mt-10">
              <h2 className="mb-4 font-display text-[20px] font-bold uppercase tracking-[0.01em]">
                Ausgabe {stats.year}
              </h2>
              <div className="rounded-xl border border-line bg-carbon p-6">
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div>
                    <div className="text-[11.5px] uppercase tracking-[0.08em] text-fog">
                      Finisher
                    </div>
                    <div className="mt-1 font-display text-[20px] font-extrabold tabular-nums">
                      {stats.finisher_count}
                    </div>
                  </div>
                  {stats.best_finish_sec !== null && (
                    <div>
                      <div className="text-[11.5px] uppercase tracking-[0.08em] text-fog">
                        Bestzeit
                      </div>
                      <div className="mt-1 font-display text-[20px] font-extrabold tabular-nums text-signal">
                        {formatRaceTime(stats.best_finish_sec)}
                      </div>
                    </div>
                  )}
                  {stats.median_finish_sec !== null && (
                    <div>
                      <div className="text-[11.5px] uppercase tracking-[0.08em] text-fog">
                        Median
                      </div>
                      <div className="mt-1 font-display text-[20px] font-extrabold tabular-nums">
                        {formatRaceTime(stats.median_finish_sec)}
                      </div>
                    </div>
                  )}
                  {stats.avg_finish_sec !== null && (
                    <div>
                      <div className="text-[11.5px] uppercase tracking-[0.08em] text-fog">
                        Schnitt
                      </div>
                      <div className="mt-1 font-display text-[20px] font-extrabold tabular-nums">
                        {formatRaceTime(stats.avg_finish_sec)}
                      </div>
                    </div>
                  )}
                </div>

                {stats.distribution && stats.distribution.length > 0 && (
                  <div className="mt-6">
                    <div className="mb-2 text-[11.5px] uppercase tracking-[0.08em] text-fog">
                      Zielzeit-Verteilung
                    </div>
                    <div className="flex h-20 items-end gap-[3px]">
                      {stats.distribution.map((bucket) => (
                        <div
                          key={bucket.from_sec}
                          title={`${formatRaceTime(bucket.from_sec)}–${formatRaceTime(bucket.to_sec)}: ${bucket.count}`}
                          className="min-h-[3px] flex-1 rounded-t bg-signal"
                          style={{
                            height: `${(bucket.count / maxBucketCount) * 100}%`,
                          }}
                        />
                      ))}
                    </div>
                    <div className="mt-1.5 flex justify-between text-[11px] text-fog">
                      <span>
                        {formatRaceTime(stats.distribution[0].from_sec)}
                      </span>
                      <span>
                        {formatRaceTime(
                          stats.distribution[stats.distribution.length - 1]
                            .to_sec,
                        )}
                      </span>
                    </div>
                  </div>
                )}

                {stats.ag_distribution && stats.ag_distribution.length > 0 && (
                  <div className="mt-6">
                    <div className="mb-2 text-[11.5px] uppercase tracking-[0.08em] text-fog">
                      Nach Altersklasse
                    </div>
                    <div className="grid gap-1.5">
                      {stats.ag_distribution.map((a) => (
                        <div
                          key={a.ag}
                          className="flex items-center gap-3 text-[12.5px]"
                        >
                          <span className="w-12 shrink-0 font-display font-semibold text-chalk">
                            {a.ag}
                          </span>
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-line">
                            <div
                              className="h-full rounded-full bg-signal-dim"
                              style={{
                                width: `${(a.count / maxAgCount) * 100}%`,
                              }}
                            />
                          </div>
                          <span className="w-8 shrink-0 text-right tabular-nums text-fog">
                            {a.count}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <p className="mt-6 text-[11.5px] text-fog">
                  Anonyme Aggregate aus öffentlichen Ergebnisdaten — keine
                  Einzelergebnisse.
                </p>
              </div>
            </div>
          )}

          <div className="mt-10">
            <h2 className="mb-4 font-display text-[20px] font-bold uppercase tracking-[0.01em]">
              Ergebnisse
            </h2>
            {resultRows.length === 0 ? (
              <div className="rounded-xl border border-line bg-carbon px-6 py-8 text-center text-[14.5px] text-fog">
                Noch keine Ergebnisse zu diesem Event eingetragen.
              </div>
            ) : (
              <div className="grid gap-px overflow-hidden rounded-[14px] border border-line bg-line">
                {resultRows.map((r) => (
                  <Link
                    key={r.id}
                    href={r.athletes ? `/@${r.athletes.handle}` : "#"}
                    className="flex items-center justify-between gap-3 bg-carbon px-5 py-3.5 transition-colors hover:bg-carbon-2"
                  >
                    <div className="flex items-center gap-3">
                      {r.athletes && (
                        <Avatar
                          name={r.athletes.display_name}
                          avatarUrl={r.athletes.avatar_url}
                          size={32}
                        />
                      )}
                      <span className="font-display text-[14.5px] font-bold uppercase">
                        {r.athletes?.display_name ?? "Unbekannt"}
                      </span>
                    </div>
                    {r.finish_time_sec !== null && (
                      <span className="font-display text-[15.5px] font-extrabold text-signal">
                        {formatRaceTime(r.finish_time_sec)}
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="mt-10">
            <h2 className="mb-4 font-display text-[20px] font-bold uppercase tracking-[0.01em]">
              Community
            </h2>
            {event.is_activated ? (
              <EventDiscussion
                eventId={event.id}
                viewerAthleteId={viewerAthlete?.id ?? null}
                posts={topLevelPosts}
              />
            ) : (
              <div className="rounded-xl border border-line bg-carbon px-6 py-8 text-center text-[14.5px] text-fog">
                {`Öffnet, sobald ${threshold} Athleten „dabei“ sind — aktuell ${participantRows.length}.`}
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
