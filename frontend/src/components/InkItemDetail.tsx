"use client";

import { InkItem } from "@/types/ink";

interface InkItemDetailProps {
  item: InkItem;
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

export default function InkItemDetail({ item, index }: InkItemDetailProps) {
  return (
    <div className="border border-sand rounded-2xl p-5 bg-white">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xs font-semibold uppercase tracking-wide text-rust">Item {index + 1}</span>
        <span className="text-xs px-2 py-0.5 rounded-full bg-sand text-charcoal">{item.item_type}</span>
        <span className="text-xs px-2 py-0.5 rounded-full bg-sand text-charcoal">{item.category}</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
        {item.category === "Ink" ? (
          <>
            <Field label="Color" value={item.color} />
            {item.color === "Spot/Pantone" && <Field label="Pantone Number" value={item.pantone_number} />}
          </>
        ) : (
          <Field label="Varnish Type" value={item.varnish_type} />
        )}
        <Field label="Grand Total Weight (kg)" value={item.item_total_weight.toFixed(2)} />
      </div>

      <div>
        <p className="text-xs text-taupe uppercase tracking-wide mb-2">Box Groups</p>
        <div className="space-y-2">
          {item.box_groups?.map((g) => (
            <div
              key={g.group_number}
              className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-charcoal bg-cream/60 border border-sand rounded-lg px-3 py-2"
            >
              <span className="text-xs font-semibold uppercase tracking-wide text-rust">
                Group {g.group_number}
              </span>
              <span>{g.number_of_boxes} Boxes</span>
              <span>×</span>
              <span>{g.containers_per_box} Containers/Box</span>
              <span>×</span>
              <span>{g.weight_per_container.toFixed(2)} kg/Container</span>
              <span className="font-semibold">= {g.group_weight.toFixed(2)} kg</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
