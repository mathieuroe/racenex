"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase-browser";

type Status = "idle" | "submitting" | "sent" | "error";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email || !email.includes("@")) return;

    setStatus("submitting");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setMessage("Da ging etwas schief — bitte nochmal versuchen.");
      setStatus("error");
      return;
    }

    setMessage(`Link geschickt an ${email}. Schau in dein Postfach.`);
    setStatus("sent");
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
            Anmelden
          </div>
          <h1 className="font-display text-[clamp(30px,5vw,44px)] font-extrabold uppercase leading-[0.98] tracking-[-0.015em]">
            Dein Profil, deine Rennen.
          </h1>
          <p className="mt-4 text-[15.5px] leading-[1.5] text-fog">
            Kein Passwort nötig — wir schicken dir einen Login-Link per E-Mail.
          </p>

          {status === "sent" ? (
            <div className="relative mt-8 animate-[pop_0.4s_ease] rounded-xl border-[1.5px] border-signal bg-signal/[0.06] px-6 py-[22px]">
              <div className="font-display text-xl font-extrabold italic uppercase text-signal">
                ∥ Fast geschafft
              </div>
              <p className="mt-1.5 text-[14.5px] text-chalk">{message}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate className="mt-8 grid gap-3.5">
              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block font-display text-[12.5px] font-bold italic uppercase tracking-[0.1em] text-signal"
                >
                  E-Mail
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="du@beispiel.de"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-[9px] border-[1.5px] border-line bg-void px-[15px] py-3.5 text-[15.5px] text-chalk transition-colors placeholder:text-[#5A636E] focus:border-signal focus:outline-none"
                />
              </div>
              {status === "error" && (
                <p className="text-[13.5px] text-[#E0402F]">{message}</p>
              )}
              <button
                type="submit"
                disabled={status === "submitting"}
                className="mt-1 rounded-[9px] bg-signal px-4 py-[15px] font-display text-[17px] font-extrabold italic uppercase tracking-[0.03em] text-white transition-colors active:translate-y-px hover:bg-chalk hover:text-void disabled:cursor-not-allowed disabled:opacity-60"
              >
                {status === "submitting" ? "Senden …" : "Login-Link ∥ senden"}
              </button>
            </form>
          )}
        </div>
      </main>
    </>
  );
}
