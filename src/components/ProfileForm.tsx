"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import CustomSelect from "@/components/CustomSelect";
import { createClient } from "@/lib/supabase-browser";
import { slugifyHandle } from "@/lib/slugifyHandle";

const AGE_GROUPS = [
  "U20",
  "AK20-24",
  "AK25-29",
  "AK30-34",
  "AK35-39",
  "AK40-44",
  "AK45-49",
  "AK50-54",
  "AK55-59",
  "AK60-64",
  "AK65-69",
  "AK70+",
];

export type Athlete = {
  handle: string;
  display_name: string;
  home_city: string | null;
  country_code: string | null;
  age_group: string | null;
  bio: string | null;
};

const MAX_HANDLE_ATTEMPTS = 25;

export default function ProfileForm({
  userId,
  existingAthlete,
}: {
  userId: string;
  existingAthlete: Athlete | null;
}) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(existingAthlete?.display_name ?? "");
  const [homeCity, setHomeCity] = useState(existingAthlete?.home_city ?? "");
  const [countryCode, setCountryCode] = useState(existingAthlete?.country_code ?? "");
  const [ageGroup, setAgeGroup] = useState(existingAthlete?.age_group ?? "");
  const [bio, setBio] = useState(existingAthlete?.bio ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [error, setError] = useState("");

  const handlePreview = existingAthlete?.handle ?? slugifyHandle(displayName || "dein-name");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!displayName.trim()) {
      setError("Anzeigename fehlt.");
      setStatus("error");
      return;
    }

    setStatus("saving");
    const supabase = createClient();

    const baseFields = {
      auth_user_id: userId,
      display_name: displayName.trim(),
      home_city: homeCity.trim() || null,
      country_code: countryCode.trim().toUpperCase() || null,
      age_group: ageGroup || null,
      bio: bio.trim() || null,
    };

    if (existingAthlete) {
      const { error: dbError } = await supabase
        .from("athletes")
        .update(baseFields)
        .eq("auth_user_id", userId);

      if (dbError) {
        setError("Speichern fehlgeschlagen — bitte nochmal versuchen.");
        setStatus("error");
        return;
      }

      router.push(`/@${existingAthlete.handle}`);
      router.refresh();
      return;
    }

    // First-time setup: auto-derive the handle, retrying with a numeric
    // suffix if it's already taken.
    const base = slugifyHandle(displayName);
    for (let attempt = 0; attempt < MAX_HANDLE_ATTEMPTS; attempt++) {
      const finalHandle = attempt === 0 ? base : `${base}_${attempt + 1}`.slice(0, 30);
      const { error: dbError } = await supabase
        .from("athletes")
        .insert({ ...baseFields, handle: finalHandle });

      if (!dbError) {
        router.push(`/@${finalHandle}`);
        router.refresh();
        return;
      }

      if (dbError.code !== "23505") {
        setError("Speichern fehlgeschlagen — bitte nochmal versuchen.");
        setStatus("error");
        return;
      }
    }

    setError("Konnte keinen freien Handle finden — bitte anderen Anzeigenamen versuchen.");
    setStatus("error");
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="mt-8 grid gap-3.5">
      <div>
        <label
          htmlFor="display_name"
          className="mb-2 block font-display text-[12.5px] font-bold italic uppercase tracking-[0.1em] text-signal"
        >
          Anzeigename
        </label>
        <input
          id="display_name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Max Mustermann"
          className="w-full rounded-[9px] border-[1.5px] border-line bg-void px-[15px] py-3.5 text-[15.5px] text-chalk transition-colors placeholder:text-[#5A636E] focus:border-signal focus:outline-none"
        />
        <p className="mt-1.5 text-[13px] text-[#5A636E]">
          Deine URL: racenex.com/@{handlePreview}
          {!existingAthlete && " (wird bei Bedarf automatisch angepasst)"}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3.5">
        <div>
          <label
            htmlFor="home_city"
            className="mb-2 block font-display text-[12.5px] font-bold italic uppercase tracking-[0.1em] text-signal"
          >
            Heimatstadt
          </label>
          <input
            id="home_city"
            value={homeCity}
            onChange={(e) => setHomeCity(e.target.value)}
            placeholder="München"
            className="w-full rounded-[9px] border-[1.5px] border-line bg-void px-[15px] py-3.5 text-[15.5px] text-chalk transition-colors placeholder:text-[#5A636E] focus:border-signal focus:outline-none"
          />
        </div>
        <div>
          <label
            htmlFor="country_code"
            className="mb-2 block font-display text-[12.5px] font-bold italic uppercase tracking-[0.1em] text-signal"
          >
            Land (ISO-2)
          </label>
          <input
            id="country_code"
            value={countryCode}
            maxLength={2}
            onChange={(e) => setCountryCode(e.target.value)}
            placeholder="DE"
            className="w-full rounded-[9px] border-[1.5px] border-line bg-void px-[15px] py-3.5 text-[15.5px] uppercase text-chalk transition-colors placeholder:text-[#5A636E] focus:border-signal focus:outline-none"
          />
        </div>
      </div>

      <CustomSelect
        label="Altersgruppe"
        placeholder="Wähle deine AK…"
        value={ageGroup}
        options={AGE_GROUPS.map((ak) => ({ value: ak, label: ak }))}
        onChange={setAgeGroup}
      />

      <div>
        <label
          htmlFor="bio"
          className="mb-2 block font-display text-[12.5px] font-bold italic uppercase tracking-[0.1em] text-signal"
        >
          Bio
        </label>
        <textarea
          id="bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={3}
          placeholder="Worauf trainierst du hin?"
          className="w-full resize-none rounded-[9px] border-[1.5px] border-line bg-void px-[15px] py-3.5 text-[15.5px] text-chalk transition-colors placeholder:text-[#5A636E] focus:border-signal focus:outline-none"
        />
      </div>

      {status === "error" && <p className="text-[13.5px] text-[#E0402F]">{error}</p>}

      <button
        type="submit"
        disabled={status === "saving"}
        className="mt-1 rounded-[9px] bg-signal px-4 py-[15px] font-display text-[17px] font-extrabold italic uppercase tracking-[0.03em] text-white transition-colors active:translate-y-px hover:bg-chalk hover:text-void disabled:cursor-not-allowed disabled:opacity-60"
      >
        {status === "saving" ? "Speichern …" : "Profil ∥ speichern"}
      </button>
    </form>
  );
}
