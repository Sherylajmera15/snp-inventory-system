"use client";

import NumberInput from "./NumberInput";
import { Plus, Trash2 } from "lucide-react";

const inputClass =
  "w-full rounded-lg border border-sand bg-cream/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust";
const labelClass = "block text-sm font-medium text-charcoal mb-1";

export const QUANTITY_UNITS = ["Kg", "Liter", "Gram", "Nos / Unit", "Other"] as const;
export type QuantityUnit = (typeof QUANTITY_UNITS)[number];

export interface QuantityGroupRow {
  numberOfPacks: string;
  quantityPerPack: string;
  unit: string;
  unitOther: string;
}

export const emptyQuantityGroup = (): QuantityGroupRow => ({
  numberOfPacks: "",
  quantityPerPack: "",
  unit: "",
  unitOther: "",
});

export function groupQuantityFor(g: QuantityGroupRow): number {
  return (parseFloat(g.numberOfPacks) || 0) * (parseFloat(g.quantityPerPack) || 0);
}

export function effectiveUnit(g: QuantityGroupRow): string {
  return g.unit === "Other" ? g.unitOther.trim() : g.unit;
}

export function quantityGroupRowFromOut(g: {
  number_of_packs: number;
  quantity_per_pack: number;
  unit: string;
}): QuantityGroupRow {
  const fixed: string[] = ["Kg", "Liter", "Gram", "Nos / Unit"];
  const isFixed = fixed.includes(g.unit);
  return {
    numberOfPacks: String(g.number_of_packs),
    quantityPerPack: String(g.quantity_per_pack),
    unit: isFixed ? g.unit : g.unit ? "Other" : "",
    unitOther: isFixed ? "" : g.unit || "",
  };
}

interface Props {
  groups: QuantityGroupRow[];
  onChange: (groups: QuantityGroupRow[]) => void;
}

export default function QuantityGroupSection({ groups, onChange }: Props) {
  const groupTotals = groups.map(groupQuantityFor);

  // per-unit totals for this section's groups
  const unitTotals: Record<string, number> = {};
  for (let i = 0; i < groups.length; i++) {
    const u = effectiveUnit(groups[i]);
    if (!u) continue;
    unitTotals[u] = (unitTotals[u] || 0) + groupTotals[i];
  }

  const update = (i: number, field: keyof QuantityGroupRow, val: string) => {
    const next = [...groups];
    next[i] = { ...next[i], [field]: val };
    onChange(next);
  };

  const add = () => onChange([...groups, emptyQuantityGroup()]);
  const remove = (i: number) => onChange(groups.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-3">
      <label className={labelClass}>Quantity Groups</label>

      {groups.map((group, i) => {
        const qty = groupTotals[i];
        const unit = effectiveUnit(group);
        return (
          <div key={i} className="border border-sand rounded-lg p-3 bg-cream/30 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-rust">
                Group {i + 1}
              </span>
              {groups.length > 1 && (
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="p-1.5 rounded-lg hover:bg-cream text-rust transition-colors"
                  title="Remove Group"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className={labelClass}>Number of Packs / Containers</label>
                <NumberInput
                  value={group.numberOfPacks}
                  onChange={(e) => update(i, "numberOfPacks", e.target.value)}
                  className={inputClass}
                  min={0}
                  step="1"
                />
              </div>
              <div>
                <label className={labelClass}>Quantity Per Pack</label>
                <NumberInput
                  value={group.quantityPerPack}
                  onChange={(e) => update(i, "quantityPerPack", e.target.value)}
                  className={inputClass}
                  min={0}
                  step="0.001"
                />
              </div>
              <div>
                <label className={labelClass}>Unit</label>
                <select
                  value={group.unit}
                  onChange={(e) => update(i, "unit", e.target.value)}
                  className={inputClass}
                >
                  <option value="" disabled>Select unit...</option>
                  {QUANTITY_UNITS.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>
            </div>

            {group.unit === "Other" && (
              <div>
                <label className={labelClass}>Custom Unit</label>
                <input
                  type="text"
                  value={group.unitOther}
                  onChange={(e) => update(i, "unitOther", e.target.value)}
                  className={inputClass}
                  placeholder="e.g. Roll, Sheet, Tin"
                />
              </div>
            )}

            <p className="text-xs text-taupe">
              Group Quantity:{" "}
              <span className="font-semibold text-charcoal">
                {qty > 0 ? qty.toFixed(3).replace(/\.?0+$/, "") : "0"}
                {unit ? ` ${unit}` : ""}
              </span>
            </p>
          </div>
        );
      })}

      <button
        type="button"
        onClick={add}
        className="inline-flex items-center gap-2 border border-dashed border-taupe text-taupe rounded-lg px-4 py-2 text-sm font-medium hover:border-rust hover:text-rust transition-colors w-full justify-center"
      >
        <Plus size={16} />
        Add Another Quantity Group
      </button>

      <div className="bg-cream/60 border border-sand rounded-lg px-4 py-2.5 space-y-1">
        <p className="text-xs font-semibold text-charcoal uppercase tracking-wide">
          Item Total Quantity
        </p>
        {Object.entries(unitTotals).length > 0 ? (
          Object.entries(unitTotals).map(([u, total]) => (
            <p key={u} className="text-sm text-charcoal">
              {u}:{" "}
              <span className="font-semibold">
                {total.toFixed(3).replace(/\.?0+$/, "")}
              </span>
            </p>
          ))
        ) : (
          <p className="text-sm text-taupe">—</p>
        )}
      </div>
    </div>
  );
}
