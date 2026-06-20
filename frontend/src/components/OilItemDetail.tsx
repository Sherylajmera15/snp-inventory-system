"use client";

import { OilItem } from "@/types/oil";

interface OilItemDetailProps {
  item: OilItem;
  index: number;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-taupe uppercase tracking-wide">{label}</p>
      <p className="text-sm text-charcoal font-medium">{value}</p>
    </div>
  );
}

export default function OilItemDetail({ item, index }: OilItemDetailProps) {
  const unitTotals: Record<string, number> = {};
  for (const g of item.quantity_groups || []) {
    const u = g.unit || "";
    if (!u) continue;
    unitTotals[u] = (unitTotals[u] || 0) + g.group_quantity;
  }

  return (
    <div className="border border-sand rounded-2xl p-5 bg-white">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xs font-semibold uppercase tracking-wide text-rust">Item {index + 1}</span>
        <span className="text-xs px-2 py-0.5 rounded-full bg-sand text-charcoal">{item.oil_name}</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        {item.manufacturer && <Field label="Manufacturer / Brand" value={item.manufacturer} />}
        {item.machine_name && <Field label="Machine Name" value={item.machine_name} />}
      </div>

      <div>
        <p className="text-xs text-taupe uppercase tracking-wide mb-2">Quantity Groups</p>
        <div className="space-y-2">
          {item.quantity_groups?.map((g) => (
            <div
              key={g.group_number}
              className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-charcoal bg-cream/60 border border-sand rounded-lg px-3 py-2"
            >
              <span className="text-xs font-semibold uppercase tracking-wide text-rust">
                Group {g.group_number}
              </span>
              <span>{g.number_of_packs} Containers</span>
              <span>×</span>
              <span>{g.quantity_per_pack} per Container</span>
              <span className="font-semibold">
                = {g.group_quantity.toFixed(3).replace(/\.?0+$/, "")}
                {g.unit ? ` ${g.unit}` : ""}
              </span>
            </div>
          ))}
        </div>

        {Object.keys(unitTotals).length > 0 && (
          <div className="mt-3 bg-cream/60 border border-sand rounded-lg px-4 py-2.5 space-y-1">
            <p className="text-xs font-semibold text-charcoal uppercase tracking-wide">Grand Total Quantity</p>
            {Object.entries(unitTotals).map(([unit, qty]) => (
              <p key={unit} className="text-sm text-charcoal">
                {unit}: <span className="font-semibold">{qty.toFixed(3).replace(/\.?0+$/, "")}</span>
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
