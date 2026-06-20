"use client";

import { InputHTMLAttributes } from "react";

type NumberInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "onWheel">;

// Wraps a numeric input and blurs on wheel so scrolling never changes the value.
export default function NumberInput(props: NumberInputProps) {
  return (
    <input
      {...props}
      type="number"
      onWheel={(e) => e.currentTarget.blur()}
      className={
        props.className ??
        "w-full rounded-lg border border-sand bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust"
      }
    />
  );
}
