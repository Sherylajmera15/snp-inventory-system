"use client";

import { useEffect, useRef, useState } from "react";

const ISSUED_BY_KEY = "snp_issued_by_names";
const RECEIVED_BY_KEY = "snp_received_by_names";
const DEFAULT_ISSUED_BY = ["Nikhil", "Navneet Mahajan", "Ajit"];

function readStored(key: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(key) ?? "[]") as string[];
  } catch {
    return [];
  }
}

function saveToStored(key: string, value: string) {
  if (!value.trim()) return;
  const existing = readStored(key);
  const trimmed = value.trim();
  if (!existing.some((s) => s.toLowerCase() === trimmed.toLowerCase())) {
    localStorage.setItem(key, JSON.stringify([...existing, trimmed]));
  }
}

function getSuggestions(key: string, query: string, defaults: string[]): string[] {
  const stored = readStored(key);
  const all = [...defaults, ...stored.filter((s) => !defaults.some((d) => d.toLowerCase() === s.toLowerCase()))];
  if (!query.trim()) return all;
  const q = query.toLowerCase();
  return all.filter((s) => s.toLowerCase().includes(q));
}

interface AutocompleteInputProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  localStorageKey: string;
  defaultSuggestions?: string[];
}

export default function AutocompleteInput({
  value,
  onChange,
  placeholder = "Name",
  className = "",
  localStorageKey,
  defaultSuggestions = [],
}: AutocompleteInputProps) {
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSuggestions(getSuggestions(localStorageKey, value, defaultSuggestions));
  }, [value, localStorageKey, defaultSuggestions]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function handleSelect(name: string) {
    onChange(name);
    saveToStored(localStorageKey, name);
    setOpen(false);
  }

  function handleBlur() {
    if (value.trim()) saveToStored(localStorageKey, value.trim());
    setTimeout(() => setOpen(false), 150);
  }

  const visibleSuggestions = suggestions.slice(0, 8);

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={handleBlur}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
      />
      {open && visibleSuggestions.length > 0 && (
        <ul className="absolute z-30 left-0 right-0 mt-1 bg-white border border-sand rounded-xl shadow-lg overflow-hidden max-h-44 overflow-y-auto">
          {visibleSuggestions.map((s) => (
            <li key={s}>
              <button
                type="button"
                onMouseDown={() => handleSelect(s)}
                className="w-full text-left px-4 py-2.5 text-sm text-charcoal hover:bg-cream transition-colors"
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Pre-configured variants for convenience
export function IssuedByInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <AutocompleteInput
      value={value}
      onChange={onChange}
      placeholder="Name"
      localStorageKey={ISSUED_BY_KEY}
      defaultSuggestions={DEFAULT_ISSUED_BY}
      className="w-full rounded-xl border border-sand bg-cream/40 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust"
    />
  );
}

export function ReceivedByInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <AutocompleteInput
      value={value}
      onChange={onChange}
      placeholder="Name"
      localStorageKey={RECEIVED_BY_KEY}
      defaultSuggestions={[]}
      className="w-full rounded-xl border border-sand bg-cream/40 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust"
    />
  );
}
