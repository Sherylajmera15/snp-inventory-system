"use client";

import { PackingMaterialItemOut } from "@/types/packing";

interface PackingItemDetailProps {
  item: PackingMaterialItemOut;
  index: number;
}

export default function PackingItemDetail({ item, index }: PackingItemDetailProps) {
  const t = item.material_type;

  return (
    <div className="border border-sand rounded-2xl p-5 bg-white space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-rust">Item {index + 1}</span>
        <span className="text-xs px-2 py-0.5 rounded-full bg-sand text-charcoal">
          {t === "Other" ? item.custom_name || t : t}
        </span>
      </div>

      {/* Printed Corrugated Boxes */}
      {t === "Printed Corrugated Boxes" && item.box_sizes && (
        <div className="space-y-2">
          <p className="text-xs text-taupe uppercase tracking-wide">Box Sizes</p>
          {item.box_sizes.map((s) => (
            <div
              key={s.size_number}
              className="bg-cream/60 border border-sand rounded-lg px-4 py-3 space-y-1"
            >
              <p className="text-xs font-semibold text-rust">Size {s.size_number}</p>
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-charcoal">
                <span>L: <strong>{s.length}</strong></span>
                <span>W: <strong>{s.width}</strong></span>
                <span>H: <strong>{s.height}</strong></span>
                <span>Qty: <strong>{s.num_boxes} Boxes</strong></span>
              </div>
            </div>
          ))}
          <div className="bg-cream border border-sand rounded-lg px-4 py-2.5">
            <p className="text-sm text-charcoal">
              Total Boxes Received:{" "}
              <span className="font-semibold text-rust">
                {item.box_sizes.reduce((acc, s) => acc + s.num_boxes, 0)}
              </span>
            </p>
          </div>
        </div>
      )}

      {/* Sutli */}
      {t === "Sutli" && item.sutli_groups && (
        <div className="space-y-2">
          <p className="text-xs text-taupe uppercase tracking-wide">Bundle Groups</p>
          {item.sutli_groups.map((g) => (
            <div
              key={g.group_number}
              className="bg-cream/60 border border-sand rounded-lg px-4 py-2.5 text-sm text-charcoal"
            >
              <span className="text-xs font-semibold text-rust mr-3">Group {g.group_number}</span>
              <strong>{g.bundle_quantity}</strong> Bundles
            </div>
          ))}
          <div className="bg-cream border border-sand rounded-lg px-4 py-2.5">
            <p className="text-sm text-charcoal">
              Total Bundles Received:{" "}
              <span className="font-semibold text-rust">
                {item.sutli_groups.reduce((acc, g) => acc + g.bundle_quantity, 0)}
              </span>
            </p>
          </div>
        </div>
      )}

      {/* Plastic Roll / Shrink Wrap Film */}
      {(t === "Plastic Roll" || t === "Shrink Wrap Film") && item.roll_weights && (
        <div className="space-y-2">
          <p className="text-xs text-taupe uppercase tracking-wide">Roll Weights</p>
          {item.roll_weights.map((r) => (
            <div
              key={r.roll_number}
              className="bg-cream/60 border border-sand rounded-lg px-4 py-2.5 text-sm text-charcoal"
            >
              <span className="text-xs font-semibold text-rust mr-3">Roll {r.roll_number}</span>
              <strong>{r.weight.toFixed(2)}</strong> Kg
            </div>
          ))}
          <div className="bg-cream border border-sand rounded-lg px-4 py-2.5">
            <p className="text-sm text-charcoal">
              {t === "Plastic Roll" ? "Total Plastic Weight" : "Total Shrink Wrap Weight"}:{" "}
              <span className="font-semibold text-rust">
                {item.roll_weights.reduce((acc, r) => acc + r.weight, 0).toFixed(2)} Kg
              </span>
            </p>
          </div>
        </div>
      )}

      {/* Other */}
      {t === "Other" && item.quantity_groups && (
        <div className="space-y-2">
          <p className="text-xs text-taupe uppercase tracking-wide">Quantity Groups</p>
          {item.quantity_groups.map((g) => (
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
          {(() => {
            const totals: Record<string, number> = {};
            for (const g of item.quantity_groups) {
              const u = g.unit || "";
              if (!u) continue;
              totals[u] = (totals[u] || 0) + g.group_quantity;
            }
            const entries = Object.entries(totals);
            if (!entries.length) return null;
            return (
              <div className="bg-cream border border-sand rounded-lg px-4 py-2.5 space-y-1">
                <p className="text-xs text-taupe uppercase tracking-wide">Grand Total Quantity</p>
                {entries.map(([unit, qty]) => (
                  <p key={unit} className="text-sm text-charcoal">
                    {unit}: <span className="font-semibold text-rust">{qty.toFixed(3).replace(/\.?0+$/, "")}</span>
                  </p>
                ))}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
