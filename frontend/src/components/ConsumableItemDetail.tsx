"use client";

import { ConsumableItem } from "@/types/consumable";

interface ConsumableItemDetailProps {
  item: ConsumableItem;
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

export default function ConsumableItemDetail({ item, index }: ConsumableItemDetailProps) {
  return (
    <div className="border border-sand rounded-2xl p-5 bg-white">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xs font-semibold uppercase tracking-wide text-rust">Item {index + 1}</span>
        <span className="text-xs px-2 py-0.5 rounded-full bg-sand text-charcoal">{item.consumable_name}</span>
      </div>

      {item.manufacturer && (
        <div className="mb-4">
          <Field label="Manufacturer / Brand" value={item.manufacturer} />
        </div>
      )}

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
              <span>{g.number_of_packs} Packs</span>
              <span>×</span>
              <span>{g.quantity_per_pack} per Pack</span>
              <span className="font-semibold">
                = {g.group_quantity.toFixed(3).replace(/\.?0+$/, "")}
                {g.unit ? ` ${g.unit}` : ""}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
