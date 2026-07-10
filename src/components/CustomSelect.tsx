"use client";

import { useEffect, useRef, useState } from "react";

export type SelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

export default function CustomSelect({
  label,
  placeholder,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  placeholder: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function openList() {
    if (disabled) return;
    setOpen(true);
    const idx = options.findIndex((o) => o.value === value);
    setActiveIndex(idx >= 0 ? idx : 0);
  }

  function commit(index: number) {
    const opt = options[index];
    if (!opt || opt.disabled) return;
    onChange(opt.value);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        openList();
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(options.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      commit(activeIndex);
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <label className="mb-2 block font-display text-[12.5px] font-bold italic uppercase tracking-[0.1em] text-signal">
        {label}
      </label>
      <button
        type="button"
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex w-full items-center justify-between rounded-[9px] border-[1.5px] border-line bg-void px-[15px] py-3.5 text-left text-[15.5px] text-chalk transition-colors focus:border-signal focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className={selected ? "text-chalk" : "text-[#5A636E]"}>
          {selected ? selected.label : placeholder}
        </span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#1B3A8F"
          strokeWidth="3"
          className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute z-50 mt-1.5 max-h-[280px] w-full overflow-auto rounded-[9px] border border-line bg-carbon py-1.5 shadow-[0_8px_24px_rgba(12,17,22,0.12)]"
        >
          {options.length === 0 && (
            <li className="px-4 py-2.5 text-[14px] text-fog">Keine Optionen</li>
          )}
          {options.map((opt, i) => (
            <li
              key={opt.value}
              role="option"
              aria-selected={opt.value === value}
              onMouseEnter={() => setActiveIndex(i)}
              onClick={() => commit(i)}
              className={`cursor-pointer px-4 py-2.5 text-[14.5px] transition-colors ${
                opt.disabled ? "cursor-not-allowed text-[#5A636E]" : "text-chalk"
              } ${i === activeIndex && !opt.disabled ? "bg-void" : ""} ${
                opt.value === value ? "font-semibold text-signal" : ""
              }`}
            >
              {opt.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
