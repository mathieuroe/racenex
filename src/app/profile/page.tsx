import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import ProfileForm from "@/components/ProfileForm";
import { createClient } from "@/lib/supabase-server";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: athlete } = await supabase
    .from("athletes")
    .select("handle, display_name, home_city, country_code, age_group, bio")
    .eq("auth_user_id", user.id)
    .maybeSingle();

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

      <main className="px-6 py-24">
        <div className="mx-auto max-w-[520px]">
          <div className="mb-[18px] flex items-center gap-[10px] font-display text-sm font-bold italic uppercase tracking-[0.14em] text-signal before:font-extrabold before:tracking-[-0.1em] before:content-['∥']">
            {athlete ? "Dein Profil" : "Profil einrichten"}
          </div>
          <h1 className="font-display text-[clamp(30px,5vw,44px)] font-extrabold uppercase leading-[0.98] tracking-[-0.015em]">
            {athlete ? "Profil bearbeiten" : "Fast geschafft."}
          </h1>
          <p className="mt-4 text-[15.5px] leading-[1.5] text-fog">
            {athlete
              ? "Änderungen werden sofort auf deiner öffentlichen Seite sichtbar."
              : "Wähle einen Handle — deine öffentliche URL wird racenex.com/@dein-handle."}
          </p>

          <ProfileForm userId={user.id} existingAthlete={athlete ?? null} />
        </div>
      </main>
    </>
  );
}
