"use client";

import { useState } from "react";
import { X } from "lucide-react";

interface SuggestionInputProps {
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  onRemoveSuggestion: (value: string) => void;
  className?: string;
  type?: "text" | "number";
  placeholder?: string;
  min?: number;
  step?: string;
}

const defaultInputClass =
  "w-full rounded-lg border border-sand bg-cream/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust";

export default function SuggestionInput({
  value,
  onChange,
  suggestions,
  onRemoveSuggestion,
  className,
  type = "text",
  placeholder,
  min,
  step,
}: SuggestionInputProps) {
  const [open, setOpen] = useState(false);

  const filtered = suggestions.filter(
    (s) => value.trim() === "" || s.toLowerCase().includes(value.trim().toLowerCase())
  );

  return (
    <div className="relative">
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onWheel={type === "number" ? (e) => e.currentTarget.blur() : undefined}
        className={className || defaultInputClass}
        placeholder={placeholder}
        min={min}
        step={step}
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <div
          className="absolute z-10 mt-1 w-full max-h-56 overflow-auto rounded-lg border border-sand bg-white shadow-lg"
          onMouseDown={(e) => e.preventDefault()}
        >
          {filtered.map((s) => (
            <div
              key={s}
              className="flex items-center justify-between px-3 py-2 text-sm hover:bg-cream/60 cursor-pointer"
              onClick={() => {
                onChange(s);
                setOpen(false);
              }}
            >
              <span className="text-charcoal">{s}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveSuggestion(s);
                }}
                className="p-1 rounded hover:bg-sand text-taupe hover:text-rust transition-colors"
                title="Remove suggestion"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
