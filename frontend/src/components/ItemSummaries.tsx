"use client";

interface ItemSummariesProps {
  summaries?: string[];
  max?: number;
}

export default function ItemSummaries({ summaries, max = 3 }: ItemSummariesProps) {
  if (!summaries?.length) return <span className="text-taupe text-xs">—</span>;
  const shown = summaries.slice(0, max);
  const extra = summaries.length - max;
  return (
    <div className="flex flex-wrap gap-1 items-center">
      {shown.map((s, i) => (
        <span
          key={i}
          className="inline-block bg-cream text-charcoal text-xs px-2 py-0.5 rounded-full border border-sand whitespace-nowrap"
        >
          {s}
        </span>
      ))}
      {extra > 0 && (
        <span className="text-xs text-taupe">+{extra} more</span>
      )}
    </div>
  );
}
