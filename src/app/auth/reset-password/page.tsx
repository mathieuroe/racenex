"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase-browser";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "error">("idle");
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (password.length < 6) {
      setError("Mindestens 6 Zeichen.");
      setStatus("error");
      return;
    }

    setStatus("submitting");
    const supabase = createClient();
    const { error: dbError } = await supabase.auth.updateUser({ password });

    if (dbError) {
      setError("Da ging etwas schief — bitte den Link erneut anfordern.");
      setStatus("error");
      return;
    }

    router.push("/profile");
    router.refresh();
  }

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
        <div className="mx-auto max-w-[440px]">
          <div className="mb-[18px] flex items-center gap-[10px] font-display text-sm font-bold italic uppercase tracking-[0.14em] text-signal before:font-extrabold before:tracking-[-0.1em] before:content-['∥']">
            Neues Passwort
          </div>
          <h1 className="font-display text-[clamp(30px,5vw,44px)] font-extrabold uppercase leading-[0.98] tracking-[-0.015em]">
            Passwort setzen
          </h1>

          <form onSubmit={handleSubmit} noValidate className="mt-8 grid gap-3.5">
            <div>
              <label
                htmlFor="password"
                className="mb-2 block font-display text-[12.5px] font-bold italic uppercase tracking-[0.1em] text-signal"
              >
                Neues Passwort
              </label>
              <input
                id="password"
                type="password"
                required
                autoComplete="new-password"
                placeholder="Mind. 6 Zeichen"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-[9px] border-[1.5px] border-line bg-void px-[15px] py-3.5 text-[15.5px] text-chalk transition-colors placeholder:text-[#5A636E] focus:border-signal focus:outline-none"
              />
            </div>
            {status === "error" && <p className="text-[13.5px] text-[#E0402F]">{error}</p>}
            <button
              type="submit"
              disabled={status === "submitting"}
              className="mt-1 rounded-[9px] bg-signal px-4 py-[15px] font-display text-[17px] font-extrabold italic uppercase tracking-[0.03em] text-white transition-colors active:translate-y-px hover:bg-chalk hover:text-void disabled:cursor-not-allowed disabled:opacity-60"
            >
              {status === "submitting" ? "Speichern …" : "Passwort speichern"}
            </button>
          </form>
        </div>
      </main>
    </>
  );
}
