import Link from "next/link";
import { signOut } from "@/app/actions/auth";
import { createClient } from "@/lib/supabase-server";

export default async function AuthNav() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: athlete } = user
    ? await supabase.from("athletes").select("handle").eq("auth_user_id", user.id).maybeSingle()
    : { data: null };

  if (!user) {
    return (
      <Link
        href="/login"
        className="font-display text-[13px] font-bold italic uppercase tracking-[0.08em] text-signal hover:text-chalk"
      >
        Login
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <Link
        href={athlete ? `/@${athlete.handle}` : "/profile"}
        className="font-display text-[13px] font-bold italic uppercase tracking-[0.08em] text-signal hover:text-chalk"
      >
        Profil
      </Link>
      <form action={signOut}>
        <button
          type="submit"
          className="font-display text-[13px] font-bold italic uppercase tracking-[0.08em] text-fog hover:text-chalk"
        >
          Abmelden
        </button>
      </form>
    </div>
  );
}
