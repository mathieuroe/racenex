"use client";

import { useState } from "react";

export default function ShareProfileButton({ handle }: { handle: string }) {
  const [copied, setCopied] = useState(false);

  async function handleClick() {
    const url = `${window.location.origin}/@${handle}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard unavailable — no-op
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      title="Profil-Link kopieren"
      className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px] border-[1.5px] border-line bg-carbon text-chalk transition-colors hover:border-signal hover:text-signal"
    >
      {copied ? (
        <span className="text-[11px] font-bold text-signal">✓</span>
      ) : (
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M18 8a3 3 0 1 0-2.83-4H15a3 3 0 0 0 .09 4.26M6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm12 6a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM8.6 13.5l6.8-3.9M8.6 10.5l6.8 3.9" />
        </svg>
      )}
    </button>
  );
}
