"use client";

import NumberInput from "./NumberInput";
import SearchableSelect from "./SearchableSelect";
import SuggestionInput from "./SuggestionInput";
import QuantityGroupSection, {
  QuantityGroupRow,
  emptyQuantityGroup,
  effectiveUnit,
  quantityGroupRowFromOut,
} from "./QuantityGroupSection";
import {
  PACKING_MATERIAL_OPTIONS,
  PackingMaterialItemOut,
  PackingSuggestions,
  PMSuggestionCategory,
} from "@/types/packing";
import { Plus, Trash2 } from "lucide-react";

const inputClass =
  "w-full rounded-lg border border-sand bg-cream/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust";
const labelClass = "block text-sm font-medium text-charcoal mb-1";

// ---- Row types for form state ----

export interface BoxSizeRow {
  length: string;
  width: string;
  height: string;
  numBoxes: string;
}

export interface SutliGroupRow {
  bundleQuantity: string;
}

export interface PackingItemRow {
  materialType: string;
  customName: string;
  boxSizes: BoxSizeRow[];
  sutliGroups: SutliGroupRow[];
  numRolls: string;
  rollWeights: string[];
  quantityGroups: QuantityGroupRow[];
}

export const emptyBoxSize = (): BoxSizeRow => ({ length: "", width: "", height: "", numBoxes: "" });
export const emptySutliGroup = (): SutliGroupRow => ({ bundleQuantity: "" });

export const emptyPackingItem = (): PackingItemRow => ({
  materialType: "",
  customName: "",
  boxSizes: [emptyBoxSize()],
  sutliGroups: [emptySutliGroup()],
  numRolls: "",
  rollWeights: [],
  quantityGroups: [emptyQuantityGroup()],
});

export function packingItemRowFromDetail(item: PackingMaterialItemOut): PackingItemRow {
  const t = item.material_type;
  return {
    materialType: t,
    customName: item.custom_name || "",
    boxSizes:
      t === "Printed Corrugated Boxes" && item.box_sizes?.length
        ? item.box_sizes.map((s) => ({
            length: String(s.length),
            width: String(s.width),
            height: String(s.height),
            numBoxes: String(s.num_boxes),
          }))
        : [emptyBoxSize()],
    sutliGroups:
      t === "Sutli" && item.sutli_groups?.length
        ? item.sutli_groups.map((g) => ({ bundleQuantity: String(g.bundle_quantity) }))
        : [emptySutliGroup()],
    numRolls:
      (t === "Plastic Roll" || t === "Shrink Wrap Film") && item.roll_weights?.length
        ? String(item.roll_weights.length)
        : "",
    rollWeights:
      (t === "Plastic Roll" || t === "Shrink Wrap Film") && item.roll_weights?.length
        ? item.roll_weights.map((r) => String(r.weight))
        : [],
    quantityGroups:
      t === "Other" && item.quantity_groups?.length
        ? item.quantity_groups.map(quantityGroupRowFromOut)
        : [emptyQuantityGroup()],
  };
}

export type ValidatePackingResult =
  | { item: Record<string, unknown>; error?: undefined }
  | { item?: undefined; error: string };

export function validatePackingItemRow(row: PackingItemRow): ValidatePackingResult {
  const t = row.materialType.trim();
  if (!t || !(PACKING_MATERIAL_OPTIONS as readonly string[]).includes(t)) {
    return { error: "Please select a Packing Material type" };
  }

  if (t === "Printed Corrugated Boxes") {
    if (!row.boxSizes.length) return { error: "Add at least one box size" };
    for (let i = 0; i < row.boxSizes.length; i++) {
      const s = row.boxSizes[i];
      if (!(parseFloat(s.length) > 0)) return { error: `Size ${i + 1}: Length must be > 0` };
      if (!(parseFloat(s.width) > 0)) return { error: `Size ${i + 1}: Width must be > 0` };
      if (!(parseFloat(s.height) > 0)) return { error: `Size ${i + 1}: Height must be > 0` };
      if (!(parseInt(s.numBoxes) > 0)) return { error: `Size ${i + 1}: Number of Boxes must be > 0` };
    }
    return {
      item: {
        material_type: t,
        box_sizes: row.boxSizes.map((s) => ({
          length: parseFloat(s.length),
          width: parseFloat(s.width),
          height: parseFloat(s.height),
          num_boxes: parseInt(s.numBoxes),
        })),
      },
    };
  }

  if (t === "Sutli") {
    if (!row.sutliGroups.length) return { error: "Add at least one bundle group" };
    for (let i = 0; i < row.sutliGroups.length; i++) {
      if (!(parseInt(row.sutliGroups[i].bundleQuantity) > 0))
        return { error: `Group ${i + 1}: Bundle quantity must be > 0` };
    }
    return {
      item: {
        material_type: t,
        sutli_groups: row.sutliGroups.map((g) => ({ bundle_quantity: parseInt(g.bundleQuantity) })),
      },
    };
  }

  if (t === "Plastic Roll" || t === "Shrink Wrap Film") {
    const n = parseInt(row.numRolls);
    if (!(n > 0)) return { error: "Number of rolls must be > 0" };
    if (row.rollWeights.length !== n)
      return { error: "Roll weight fields do not match number of rolls" };
    for (let i = 0; i < n; i++) {
      if (!(parseFloat(row.rollWeights[i]) > 0))
        return { error: `Weight for Roll ${i + 1} must be > 0` };
    }
    return {
      item: {
        material_type: t,
        roll_weights: row.rollWeights.map((w) => ({ weight: parseFloat(w) })),
      },
    };
  }

  if (t === "Other") {
    if (!row.customName.trim()) return { error: "Custom material name is required" };
    for (let i = 0; i < row.quantityGroups.length; i++) {
      const g = row.quantityGroups[i];
      if (!(parseFloat(g.numberOfPacks) > 0))
        return { error: `Group ${i + 1}: Number of packs must be > 0` };
      if (!(parseFloat(g.quantityPerPack) > 0))
        return { error: `Group ${i + 1}: Quantity per pack must be > 0` };
      if (!effectiveUnit(g))
        return { error: `Group ${i + 1}: Unit is required` };
    }
    return {
      item: {
        material_type: t,
        custom_name: row.customName.trim(),
        quantity_groups: row.quantityGroups.map((g) => ({
          number_of_packs: parseFloat(g.numberOfPacks),
          quantity_per_pack: parseFloat(g.quantityPerPack),
          unit: effectiveUnit(g),
        })),
      },
    };
  }

  return { error: "Unknown material type" };
}

// ---- Component ----

interface PackingItemFieldsProps {
  row: PackingItemRow;
  index: number;
  suggestions?: PackingSuggestions;
  onRemoveSuggestion?: (category: PMSuggestionCategory, value: string) => void;
  onChange: (next: PackingItemRow) => void;
  onRemove?: () => void;
}

export default function PackingItemFields({
  row,
  index,
  suggestions,
  onRemoveSuggestion,
  onChange,
  onRemove,
}: PackingItemFieldsProps) {
  const t = row.materialType;

  const handleTypeChange = (val: string) => {
    // Reset type-specific state when type changes
    onChange({ ...row, materialType: val });
  };

  const updateBoxSize = (i: number, patch: Partial<BoxSizeRow>) => {
    const next = [...row.boxSizes];
    next[i] = { ...next[i], ...patch };
    onChange({ ...row, boxSizes: next });
  };

  const updateSutliGroup = (i: number, val: string) => {
    const next = [...row.sutliGroups];
    next[i] = { bundleQuantity: val };
    onChange({ ...row, sutliGroups: next });
  };

  const handleNumRollsChange = (val: string) => {
    const n = Math.max(0, parseInt(val) || 0);
    const newWeights = Array.from({ length: n }, (_, i) => row.rollWeights[i] ?? "");
    onChange({ ...row, numRolls: val, rollWeights: newWeights });
  };

  const updateRollWeight = (i: number, val: string) => {
    const next = [...row.rollWeights];
    next[i] = val;
    onChange({ ...row, rollWeights: next });
  };

  // Computed totals for display
  const totalBoxes = row.boxSizes.reduce((acc, s) => acc + (parseInt(s.numBoxes) || 0), 0);
  const totalBundles = row.sutliGroups.reduce((acc, g) => acc + (parseInt(g.bundleQuantity) || 0), 0);
  const totalRollWeight = row.rollWeights.reduce((acc, w) => acc + (parseFloat(w) || 0), 0);

  const weightLabel =
    t === "Plastic Roll" ? "Total Plastic Weight" : "Total Shrink Wrap Weight";

  return (
    <div className="border border-sand rounded-2xl p-5 bg-white space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-rust">
          Item {index + 1}
        </span>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="p-1.5 rounded-lg hover:bg-cream text-rust transition-colors"
            title="Remove Item"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {/* Material Type */}
      <div>
        <label className={labelClass}>Packing Material Type</label>
        <SearchableSelect
          options={PACKING_MATERIAL_OPTIONS}
          value={t}
          onChange={handleTypeChange}
          placeholder="Type to search material..."
          className={inputClass}
        />
      </div>

      {/* ---- Printed Corrugated Boxes ---- */}
      {t === "Printed Corrugated Boxes" && (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-taupe">Box Sizes</p>
          {row.boxSizes.map((s, i) => (
            <div key={i} className="border border-sand/60 rounded-xl p-4 bg-cream/40 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-rust">Size {i + 1}</span>
                {row.boxSizes.length > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      onChange({ ...row, boxSizes: row.boxSizes.filter((_, idx) => idx !== i) })
                    }
                    className="p-1 hover:bg-cream rounded text-rust"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className={labelClass}>Length</label>
                  <NumberInput
                    value={s.length}
                    onChange={(e) => updateBoxSize(i, { length: e.target.value })}
                    placeholder="cm"
                    className={inputClass}
                    min={0}
                    step="any"
                  />
                </div>
                <div>
                  <label className={labelClass}>Width</label>
                  <NumberInput
                    value={s.width}
                    onChange={(e) => updateBoxSize(i, { width: e.target.value })}
                    placeholder="cm"
                    className={inputClass}
                    min={0}
                    step="any"
                  />
                </div>
                <div>
                  <label className={labelClass}>Height</label>
                  <NumberInput
                    value={s.height}
                    onChange={(e) => updateBoxSize(i, { height: e.target.value })}
                    placeholder="cm"
                    className={inputClass}
                    min={0}
                    step="any"
                  />
                </div>
                <div>
                  <label className={labelClass}>No. of Boxes</label>
                  <NumberInput
                    value={s.numBoxes}
                    onChange={(e) => updateBoxSize(i, { numBoxes: e.target.value })}
                    placeholder="0"
                    className={inputClass}
                    min={0}
                  />
                </div>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() => onChange({ ...row, boxSizes: [...row.boxSizes, emptyBoxSize()] })}
            className="inline-flex items-center gap-1.5 text-sm text-taupe hover:text-rust border border-dashed border-taupe hover:border-rust rounded-lg px-3 py-2 transition-colors w-full justify-center"
          >
            <Plus size={14} />
            Add Another Box Size
          </button>
          {totalBoxes > 0 && (
            <div className="bg-cream border border-sand rounded-lg px-4 py-2.5">
              <p className="text-sm text-charcoal">
                Total Boxes Received:{" "}
                <span className="font-semibold text-rust">{totalBoxes}</span>
              </p>
            </div>
          )}
        </div>
      )}

      {/* ---- Sutli ---- */}
      {t === "Sutli" && (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-taupe">Bundle Groups</p>
          {row.sutliGroups.map((g, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="flex-1">
                <label className={labelClass}>Group {i + 1} — Number of Bundles</label>
                <NumberInput
                  value={g.bundleQuantity}
                  onChange={(e) => updateSutliGroup(i, e.target.value)}
                  placeholder="0"
                  className={inputClass}
                  min={0}
                />
              </div>
              {row.sutliGroups.length > 1 && (
                <button
                  type="button"
                  onClick={() =>
                    onChange({ ...row, sutliGroups: row.sutliGroups.filter((_, idx) => idx !== i) })
                  }
                  className="mt-5 p-1.5 hover:bg-cream rounded text-rust"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              onChange({ ...row, sutliGroups: [...row.sutliGroups, emptySutliGroup()] })
            }
            className="inline-flex items-center gap-1.5 text-sm text-taupe hover:text-rust border border-dashed border-taupe hover:border-rust rounded-lg px-3 py-2 transition-colors w-full justify-center"
          >
            <Plus size={14} />
            Add Another Group
          </button>
          {totalBundles > 0 && (
            <div className="bg-cream border border-sand rounded-lg px-4 py-2.5">
              <p className="text-sm text-charcoal">
                Total Bundles Received:{" "}
                <span className="font-semibold text-rust">{totalBundles}</span>
              </p>
            </div>
          )}
        </div>
      )}

      {/* ---- Plastic Roll / Shrink Wrap Film ---- */}
      {(t === "Plastic Roll" || t === "Shrink Wrap Film") && (
        <div className="space-y-3">
          <div>
            <label className={labelClass}>Number of Rolls</label>
            <NumberInput
              value={row.numRolls}
              onChange={(e) => handleNumRollsChange(e.target.value)}
              placeholder="0"
              className={inputClass}
              min={0}
            />
          </div>
          {row.rollWeights.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-taupe">Roll Weights (Kg)</p>
              {row.rollWeights.map((w, i) => (
                <div key={i}>
                  <label className={labelClass}>Weight of Roll {i + 1} (Kg)</label>
                  <NumberInput
                    value={w}
                    onChange={(e) => updateRollWeight(i, e.target.value)}
                    placeholder="0.00"
                    className={inputClass}
                    min={0}
                    step="any"
                  />
                </div>
              ))}
              {totalRollWeight > 0 && (
                <div className="bg-cream border border-sand rounded-lg px-4 py-2.5">
                  <p className="text-sm text-charcoal">
                    {weightLabel}:{" "}
                    <span className="font-semibold text-rust">{totalRollWeight.toFixed(2)} Kg</span>
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ---- Other ---- */}
      {t === "Other" && (
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Custom Material Name</label>
            <SuggestionInput
              value={row.customName}
              onChange={(v) => onChange({ ...row, customName: v })}
              suggestions={suggestions?.custom_names || []}
              onRemoveSuggestion={(v) => onRemoveSuggestion?.("custom_name", v)}
              className={inputClass}
              placeholder="Enter packing material name"
            />
          </div>
          <QuantityGroupSection
            groups={row.quantityGroups}
            onChange={(groups) => onChange({ ...row, quantityGroups: groups })}
          />
        </div>
      )}
    </div>
  );
}
