"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase-browser";

export default function FollowButton({
  viewerAthleteId,
  targetAthleteId,
  initiallyFollowing,
}: {
  viewerAthleteId: string;
  targetAthleteId: string;
  initiallyFollowing: boolean;
}) {
  const router = useRouter();
  const [following, setFollowing] = useState(initiallyFollowing);
  const [pending, setPending] = useState(false);

  async function toggle() {
    setPending(true);
    const supabase = createClient();

    if (following) {
      const { error } = await supabase
        .from("follows")
        .delete()
        .eq("follower_id", viewerAthleteId)
        .eq("followed_id", targetAthleteId);
      if (!error) setFollowing(false);
    } else {
      const { error } = await supabase
        .from("follows")
        .insert({ follower_id: viewerAthleteId, followed_id: targetAthleteId });
      if (!error) setFollowing(true);
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
        following
          ? "shrink-0 rounded-[9px] border-[1.5px] border-signal px-4 py-2.5 font-display text-[13px] font-bold italic uppercase tracking-[0.04em] text-signal transition-colors hover:bg-signal/[0.06] disabled:opacity-60"
          : "shrink-0 rounded-[9px] border-[1.5px] border-signal bg-signal px-4 py-2.5 font-display text-[13px] font-bold italic uppercase tracking-[0.04em] text-white transition-colors hover:bg-signal-dim disabled:opacity-60"
      }
    >
      {following ? "✓ Folgt" : "Folgen"}
    </button>
  );
}
