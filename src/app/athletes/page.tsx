import Image from "next/image";
import Link from "next/link";
import AthleteSearch, { type AthleteCard } from "@/components/AthleteSearch";
import AuthNav from "@/components/AuthNav";
import { supabase } from "@/lib/supabase";
import { createClient } from "@/lib/supabase-server";

export const revalidate = 0;

export default async function AthletesPage() {
  const { data } = await supabase
    .from("athletes")
    .select(
      "handle, display_name, home_city, country_code, age_group, avatar_url",
    )
    .order("display_name", { ascending: true })
    .limit(500);

  const athletes = (data ?? []) as AthleteCard[];

  const authed = await createClient();
  const {
    data: { user },
  } = await authed.auth.getUser();

  const { data: viewer } = user
    ? await supabase
        .from("athletes")
        .select("home_city")
        .eq("auth_user_id", user.id)
        .maybeSingle()
    : { data: null };

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-line bg-void/85 backdrop-blur-md">
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
          <AuthNav />
        </div>
      </header>

      <main className="px-6 py-14">
        <div className="mx-auto max-w-[720px]">
          <div className="mb-[18px] flex items-center gap-[10px] font-display text-sm font-bold italic uppercase tracking-[0.14em] text-signal before:font-extrabold before:tracking-[-0.1em] before:content-['∥']">
            Athleten
          </div>
          <h1 className="font-display text-[clamp(30px,5vw,46px)] font-extrabold uppercase leading-[0.98] tracking-[-0.015em]">
            Finde deine Leute
          </h1>
          <p className="mt-4 max-w-[52ch] text-[15.5px] leading-[1.5] text-fog">
            Durchsuche alle racenex-Profile — nach Name, Handle oder Stadt.
          </p>

          <div className="mt-10">
            <AthleteSearch
              athletes={athletes}
              viewerHomeCity={viewer?.home_city ?? null}
            />
          </div>
        </div>
      </main>
    </>
  );
}
