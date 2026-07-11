import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import AddResultForm from "@/components/AddResultForm";
import Avatar from "@/components/Avatar";
import FollowButton from "@/components/FollowButton";
import NextRaceForm from "@/components/NextRaceForm";
import ShareProfileButton from "@/components/ShareProfileButton";
import { supabase } from "@/lib/supabase";
import { createClient } from "@/lib/supabase-server";
import { formatCountdown, formatRaceTime } from "@/lib/raceTime";
import { SPORT_LABEL, SPORT_ORDER } from "@/lib/sportLabels";

export const revalidate = 0;

type ResultRow = {
  id: string;
  event_label: string | null;
  event_date: string | null;
  sport_type: string | null;
  finish_time_sec: number | null;
  official_url: string | null;
};

function formatResultDate(iso: string | null): string {
  if (!iso) return "Datum offen";
  return new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatEventDate(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default async function AthleteProfilePage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;

  const { data: athlete } = await supabase
    .from("athletes")
    .select(
      "id, handle, display_name, home_city, country_code, age_group, bio, avatar_url, auth_user_id",
    )
    .eq("handle", handle)
    .maybeSingle();

  if (!athlete) {
    notFound();
  }

  const authed = await createClient();
  const {
    data: { user },
  } = await authed.auth.getUser();
  const isOwnProfile = user?.id === athlete.auth_user_id;

  const { data: viewerAthlete } =
    user && !isOwnProfile
      ? await supabase
          .from("athletes")
          .select("id")
          .eq("auth_user_id", user.id)
          .maybeSingle()
      : { data: null };

  const { count: followerCount } = await supabase
    .from("follows")
    .select("*", { count: "exact", head: true })
    .eq("followed_id", athlete.id);

  const { count: followingCount } = await supabase
    .from("follows")
    .select("*", { count: "exact", head: true })
    .eq("follower_id", athlete.id);

  const { data: existingFollow } = viewerAthlete
    ? await supabase
        .from("follows")
        .select("follower_id")
        .eq("follower_id", viewerAthlete.id)
        .eq("followed_id", athlete.id)
        .maybeSingle()
    : { data: null };

  const { data: results } = await supabase
    .from("results")
    .select(
      "id, event_label, event_date, sport_type, finish_time_sec, official_url",
    )
    .eq("athlete_id", athlete.id)
    .order("event_date", { ascending: false });

  const resultRows = (results ?? []) as ResultRow[];

  const raceCount = resultRows.length;
  const pbBySport = SPORT_ORDER.map((sport) => {
    const times = resultRows
      .filter((r) => r.sport_type === sport && r.finish_time_sec !== null)
      .map((r) => r.finish_time_sec as number);
    return times.length ? { sport, bestSec: Math.min(...times) } : null;
  }).filter((x): x is { sport: string; bestSec: number } => x !== null);

  const { data: eventOptions } = isOwnProfile
    ? await supabase
        .from("events")
        .select("id, name, sport_type, event_date, city")
        .order("event_date", { ascending: false })
    : { data: null };

  const today = new Date().toISOString().slice(0, 10);
  const { data: upcoming } = await supabase
    .from("participations")
    .select("events!inner(id, slug, name, event_date, city)")
    .eq("athlete_id", athlete.id)
    .in("status", ["interested", "registered"])
    .gte("events.event_date", today);

  const nextRace =
    (upcoming ?? [])
      .map(
        (p) =>
          p.events as unknown as {
            id: string;
            slug: string;
            name: string;
            event_date: string;
            city: string | null;
          },
      )
      .sort((a, b) => a.event_date.localeCompare(b.event_date))[0] ?? null;

  const { data: upcomingEventOptions } = isOwnProfile
    ? await supabase
        .from("events")
        .select("id, name, event_date, city")
        .gte("event_date", today)
        .not("event_date", "is", null)
        .order("event_date", { ascending: true })
    : { data: null };

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
          <div className="flex items-center gap-4">
            <ShareProfileButton handle={athlete.handle} />
            {isOwnProfile && (
              <Link
                href="/profile"
                className="font-display text-[13px] font-bold italic uppercase tracking-[0.08em] text-signal hover:text-chalk"
              >
                Profil bearbeiten
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="px-6 py-24">
        <div className="mx-auto max-w-[640px]">
          <div className="flex items-start gap-5">
            <Avatar
              name={athlete.display_name}
              avatarUrl={athlete.avatar_url}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-[10px] font-display text-sm font-bold italic uppercase tracking-[0.14em] text-signal before:font-extrabold before:tracking-[-0.1em] before:content-['∥']">
                    @{athlete.handle}
                  </div>
                  <h1 className="font-display text-[clamp(30px,5vw,52px)] font-extrabold uppercase leading-[0.98] tracking-[-0.015em]">
                    {athlete.display_name}
                  </h1>
                </div>
                {viewerAthlete && (
                  <FollowButton
                    viewerAthleteId={viewerAthlete.id}
                    targetAthleteId={athlete.id}
                    initiallyFollowing={!!existingFollow}
                  />
                )}
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[14.5px] text-fog">
                {athlete.home_city && <span>{athlete.home_city}</span>}
                {athlete.country_code && <span>{athlete.country_code}</span>}
                {athlete.age_group && (
                  <span className="font-display font-semibold uppercase text-signal">
                    {athlete.age_group}
                  </span>
                )}
              </div>

              <div className="mt-2.5 flex gap-4 text-[13.5px] text-fog">
                <span>
                  <b className="font-semibold text-chalk">
                    {followerCount ?? 0}
                  </b>{" "}
                  Follower
                </span>
                <span>
                  <b className="font-semibold text-chalk">
                    {followingCount ?? 0}
                  </b>{" "}
                  Folgt
                </span>
              </div>

              {athlete.bio && (
                <p className="mt-6 max-w-[52ch] text-[15.5px] leading-[1.5] text-chalk">
                  {athlete.bio}
                </p>
              )}
            </div>
          </div>

          {(nextRace || isOwnProfile) && (
            <div className="mt-6">
              {nextRace ? (
                <Link
                  href={`/event/${nextRace.slug}`}
                  className="flex items-center justify-between gap-4 rounded-xl border border-signal/20 bg-signal/[0.05] px-[18px] py-3.5 transition-colors hover:bg-signal/[0.09]"
                >
                  <div>
                    <div className="font-display text-[12px] font-bold italic uppercase tracking-[0.1em] text-signal">
                      Nächstes Rennen
                    </div>
                    <div className="mt-0.5 font-display text-[15px] font-extrabold uppercase">
                      {nextRace.name}
                    </div>
                    <div className="mt-0.5 text-[12.5px] text-fog">
                      {formatEventDate(nextRace.event_date)}
                      {nextRace.city ? ` · ${nextRace.city}` : ""}
                    </div>
                  </div>
                  <div className="shrink-0 font-display text-[15px] font-extrabold italic text-signal">
                    {formatCountdown(nextRace.event_date)}
                  </div>
                </Link>
              ) : (
                <NextRaceForm
                  athleteId={athlete.id}
                  events={upcomingEventOptions ?? []}
                />
              )}
            </div>
          )}

          {raceCount > 0 && (
            <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-[14px] border border-line bg-line sm:grid-cols-4">
              <div className="bg-carbon px-4 py-3.5">
                <div className="text-[11.5px] uppercase tracking-[0.08em] text-fog">
                  Rennen
                </div>
                <div className="mt-1 font-display text-[20px] font-extrabold tabular-nums">
                  {raceCount}
                </div>
              </div>
              {pbBySport.map(({ sport, bestSec }) => (
                <div key={sport} className="bg-carbon px-4 py-3.5">
                  <div className="text-[11.5px] uppercase tracking-[0.08em] text-fog">
                    PB {SPORT_LABEL[sport] ?? sport}
                  </div>
                  <div className="mt-1 font-display text-[20px] font-extrabold tabular-nums">
                    {formatRaceTime(bestSec)}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-14">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-[20px] font-bold uppercase tracking-[0.01em]">
                Renn-Historie
              </h2>
              {isOwnProfile && (
                <AddResultForm
                  athleteId={athlete.id}
                  events={eventOptions ?? []}
                />
              )}
            </div>

            {resultRows.length === 0 ? (
              <div className="rounded-xl border border-line bg-carbon px-6 py-8 text-center text-[14.5px] text-fog">
                Noch keine Renn-Historie. Sobald{" "}
                {isOwnProfile ? "du" : "dieser Athlet"} Ergebnisse einträgt,
                stehen sie hier.
              </div>
            ) : (
              <div className="grid gap-px overflow-hidden rounded-[14px] border border-line bg-line">
                {resultRows.map((r) => (
                  <div
                    key={r.id}
                    className="flex flex-wrap items-center justify-between gap-2 bg-carbon px-5 py-4"
                  >
                    <div>
                      <div className="font-display text-[16px] font-bold uppercase leading-[1.1]">
                        {r.event_label ?? "Rennen"}
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-[13px] text-fog">
                        <span>{formatResultDate(r.event_date)}</span>
                        {r.sport_type && (
                          <span>
                            {SPORT_LABEL[r.sport_type] ?? r.sport_type}
                          </span>
                        )}
                        {r.official_url && (
                          <a
                            href={r.official_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-signal hover:text-chalk"
                          >
                            Ergebnisliste ↗
                          </a>
                        )}
                      </div>
                    </div>
                    {r.finish_time_sec !== null && (
                      <div className="font-display text-[18px] font-extrabold text-signal">
                        {formatRaceTime(r.finish_time_sec)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
