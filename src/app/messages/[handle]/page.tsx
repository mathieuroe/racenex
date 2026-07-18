import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import Avatar from "@/components/Avatar";
import MessageThread, { type MessageRow } from "@/components/MessageThread";
import { supabase } from "@/lib/supabase";
import { createClient } from "@/lib/supabase-server";

export const revalidate = 0;

export default async function MessageThreadPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;

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

  const { data: otherAthlete } = await supabase
    .from("athletes")
    .select("id, handle, display_name, avatar_url")
    .eq("handle", handle)
    .maybeSingle();

  if (!otherAthlete || otherAthlete.id === viewerAthlete.id) {
    notFound();
  }

  const { data: messages } = await authed
    .from("messages")
    .select("id, sender_id, body, created_at")
    .or(
      `and(sender_id.eq.${viewerAthlete.id},recipient_id.eq.${otherAthlete.id}),and(sender_id.eq.${otherAthlete.id},recipient_id.eq.${viewerAthlete.id})`,
    )
    .order("created_at", { ascending: true });

  await authed
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("sender_id", otherAthlete.id)
    .eq("recipient_id", viewerAthlete.id)
    .is("read_at", null);

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
            href="/messages"
            className="font-display text-[13px] font-bold italic uppercase tracking-[0.08em] text-signal hover:text-chalk"
          >
            ← Nachrichten
          </Link>
        </div>
      </header>

      <main className="px-6 py-14">
        <div className="mx-auto max-w-[560px]">
          <Link
            href={`/@${otherAthlete.handle}`}
            className="mb-8 flex items-center gap-3"
          >
            <Avatar
              name={otherAthlete.display_name}
              avatarUrl={otherAthlete.avatar_url}
              size={40}
            />
            <div>
              <div className="font-display text-[17px] font-extrabold uppercase leading-tight hover:text-signal">
                {otherAthlete.display_name}
              </div>
              <div className="text-[13px] text-fog">@{otherAthlete.handle}</div>
            </div>
          </Link>

          <MessageThread
            viewerAthleteId={viewerAthlete.id}
            otherAthleteId={otherAthlete.id}
            messages={(messages ?? []) as MessageRow[]}
          />
        </div>
      </main>
    </>
  );
}
