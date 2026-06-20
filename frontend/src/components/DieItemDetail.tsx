"use client";

import { DieItem } from "@/types/dies";

interface DieItemDetailProps {
  item: DieItem;
  index: number;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="text-taupe min-w-[140px] text-xs uppercase tracking-wide font-medium pt-0.5">
        {label}
      </span>
      <span className="text-charcoal font-medium">{value}</span>
    </div>
  );
}

export default function DieItemDetail({ item, index }: DieItemDetailProps) {
  const statusColor =
    item.status === "Active"
      ? "bg-green-100 text-green-800 border-green-200"
      : "bg-gray-100 text-gray-600 border-gray-200";

  const hasDimensions = item.length != null || item.width != null || item.height != null;
  const dimParts = [
    item.length != null ? `L: ${item.length}` : null,
    item.width != null ? `W: ${item.width}` : null,
    item.height != null ? `H: ${item.height}` : null,
  ].filter(Boolean);

  return (
    <div className="border border-sand rounded-xl p-4 space-y-3 bg-white">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <span className="text-xs font-semibold text-taupe uppercase tracking-wide">
          Die #{index + 1}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-charcoal">{item.die_number}</span>
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${statusColor}`}
          >
            {item.status}
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <Row label="Job Name" value={item.job_name} />
        <Row label="UPS" value={item.ups} />
        <Row label="Embossing" value={item.embossing} />
        {item.embossing === "Yes" && (
          <Row label="Female Block" value={item.female_block || "—"} />
        )}
        <Row label="Rubberized" value={item.rubberized} />
        {hasDimensions && <Row label="Dimensions (mm)" value={dimParts.join("  ·  ")} />}
        {item.storage_location && (
          <Row label="Storage Location" value={item.storage_location} />
        )}
        {item.status === "Discontinued" && item.discontinued_date && (
          <Row
            label="Discontinued On"
            value={new Date(item.discontinued_date).toLocaleDateString("en-GB")}
          />
        )}
      </div>
    </div>
  );
}
