"use client";

import {
  BoxGroupInput,
  CATEGORY_OPTIONS,
  Category,
  CONVENTIONAL_INK_COLORS,
  CONVENTIONAL_VARNISH_TYPES,
  InkItemInput,
  InkSuggestionCategory,
  InkSuggestions,
  ITEM_TYPE_OPTIONS,
  ItemType,
  UV_INK_COLORS,
  UV_VARNISH_TYPES,
} from "@/types/ink";
import NumberInput from "./NumberInput";
import SuggestionInput from "./SuggestionInput";
import { Plus, Trash2 } from "lucide-react";

const inputClass =
  "w-full rounded-lg border border-sand bg-cream/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust";
const labelClass = "block text-sm font-medium text-charcoal mb-1";

export interface BoxGroupRow {
  numberOfBoxes: string;
  containersPerBox: string;
  weightPerContainer: string;
}

export interface InkItemRow {
  itemType: ItemType | "";
  category: Category | "";
  color: string;
  pantoneNumber: string;
  varnishType: string;
  varnishTypeOther: string;
  boxGroups: BoxGroupRow[];
}

export const emptyBoxGroup = (): BoxGroupRow => ({
  numberOfBoxes: "",
  containersPerBox: "",
  weightPerContainer: "",
});

export const emptyInkItem = (): InkItemRow => ({
  itemType: "",
  category: "",
  color: "",
  pantoneNumber: "",
  varnishType: "",
  varnishTypeOther: "",
  boxGroups: [emptyBoxGroup()],
});

const VARNISH_PRESETS: Record<ItemType, readonly string[]> = {
  "UV Ink": UV_VARNISH_TYPES,
  "Conventional Ink": CONVENTIONAL_VARNISH_TYPES,
};

const INK_COLORS: Record<ItemType, readonly string[]> = {
  "UV Ink": UV_INK_COLORS,
  "Conventional Ink": CONVENTIONAL_INK_COLORS,
};

export function groupWeightFor(g: { numberOfBoxes: string; containersPerBox: string; weightPerContainer: string }): number {
  return (
    (parseInt(g.numberOfBoxes, 10) || 0) *
    (parseInt(g.containersPerBox, 10) || 0) *
    (parseFloat(g.weightPerContainer) || 0)
  );
}

export function inkItemRowFromItem(item: InkItemInput): InkItemRow {
  const initialVarnishIsPreset =
    !!item.item_type &&
    !!item.varnish_type &&
    VARNISH_PRESETS[item.item_type].includes(item.varnish_type) &&
    item.varnish_type !== "Other";
  return {
    itemType: item.item_type || "",
    category: item.category || "",
    color: item.color || "",
    pantoneNumber: item.pantone_number || "",
    varnishType: initialVarnishIsPreset ? item.varnish_type! : item.varnish_type ? "Other" : "",
    varnishTypeOther: !initialVarnishIsPreset ? item.varnish_type || "" : "",
    boxGroups: item.box_groups?.length
      ? item.box_groups.map((g) => ({
          numberOfBoxes: String(g.number_of_boxes),
          containersPerBox: String(g.containers_per_box),
          weightPerContainer: String(g.weight_per_container),
        }))
      : [emptyBoxGroup()],
  };
}

export function validateInkItemRow(row: InkItemRow): { item: InkItemInput; error?: undefined } | { item?: undefined; error: string } {
  if (!row.itemType) return { error: "Please select UV Ink or Conventional Ink" };
  if (!row.category) return { error: "Please select Ink or Varnish" };

  if (row.category === "Ink") {
    if (!row.color) return { error: "Please select a Color" };
    if (row.color === "Spot/Pantone" && !row.pantoneNumber.trim()) {
      return { error: "Pantone Number is required for Spot/Pantone" };
    }
  } else {
    if (!row.varnishType) return { error: "Please select a Varnish Type" };
    if (row.varnishType === "Other" && !row.varnishTypeOther.trim()) {
      return { error: "Please enter a Custom Varnish Type" };
    }
  }

  for (const g of row.boxGroups) {
    if (
      !g.numberOfBoxes ||
      !g.containersPerBox ||
      !g.weightPerContainer ||
      parseInt(g.numberOfBoxes, 10) <= 0 ||
      parseInt(g.containersPerBox, 10) <= 0 ||
      parseFloat(g.weightPerContainer) <= 0
    ) {
      return { error: "Number of Boxes, Containers Per Box and Weight Per Container are required for every box group" };
    }
  }

  const finalVarnishType =
    row.category === "Varnish" ? (row.varnishType === "Other" ? row.varnishTypeOther.trim() : row.varnishType) : null;

  const item: InkItemInput = {
    item_type: row.itemType,
    category: row.category,
    color: row.category === "Ink" ? row.color : null,
    pantone_number: row.category === "Ink" && row.color === "Spot/Pantone" ? row.pantoneNumber.trim() : null,
    varnish_type: finalVarnishType,
    box_groups: row.boxGroups.map((g): BoxGroupInput => ({
      number_of_boxes: parseInt(g.numberOfBoxes, 10),
      containers_per_box: parseInt(g.containersPerBox, 10),
      weight_per_container: parseFloat(g.weightPerContainer),
    })),
  };

  return { item };
}

interface InkItemFieldsProps {
  row: InkItemRow;
  index: number;
  suggestions?: InkSuggestions;
  onRemoveSuggestion?: (category: InkSuggestionCategory, value: string) => void;
  onChange: (row: InkItemRow) => void;
  onRemove?: () => void;
}

export default function InkItemFields({ row, index, suggestions, onRemoveSuggestion, onChange, onRemove }: InkItemFieldsProps) {
  const groupWeights = row.boxGroups.map(groupWeightFor);
  const itemTotalWeight = groupWeights.reduce((sum, w) => sum + w, 0);

  const handleItemTypeChange = (value: ItemType) => {
    onChange({ ...row, itemType: value, category: "", color: "", pantoneNumber: "", varnishType: "", varnishTypeOther: "" });
  };

  const handleCategoryChange = (value: Category) => {
    onChange({ ...row, category: value, color: "", pantoneNumber: "", varnishType: "", varnishTypeOther: "" });
  };

  const updateBoxGroup = (i: number, field: keyof BoxGroupRow, value: string) => {
    const next = [...row.boxGroups];
    next[i] = { ...next[i], [field]: value };
    onChange({ ...row, boxGroups: next });
  };

  const addBoxGroup = () => onChange({ ...row, boxGroups: [...row.boxGroups, emptyBoxGroup()] });
  const removeBoxGroup = (i: number) => onChange({ ...row, boxGroups: row.boxGroups.filter((_, idx) => idx !== i) });

  return (
    <div className="border border-sand rounded-2xl p-5 bg-white space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-rust">Item {index + 1}</span>
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

      <div>
        <label className={labelClass}>Item Type</label>
        <select
          value={row.itemType}
          onChange={(e) => handleItemTypeChange(e.target.value as ItemType)}
          className={inputClass}
        >
          <option value="" disabled>
            Select...
          </option>
          {ITEM_TYPE_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>

      {row.itemType && (
        <div>
          <label className={labelClass}>Ink / Varnish</label>
          <select
            value={row.category}
            onChange={(e) => handleCategoryChange(e.target.value as Category)}
            className={inputClass}
          >
            <option value="" disabled>
              Select...
            </option>
            {CATEGORY_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
      )}

      {row.itemType && row.category === "Ink" && (
        <div className="space-y-3">
          <div>
            <label className={labelClass}>Color</label>
            <select value={row.color} onChange={(e) => onChange({ ...row, color: e.target.value })} className={inputClass}>
              <option value="" disabled>
                Select...
              </option>
              {INK_COLORS[row.itemType].map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
          {row.color === "Spot/Pantone" && (
            <div>
              <label className={labelClass}>Pantone Number</label>
              <SuggestionInput
                value={row.pantoneNumber}
                onChange={(value) => onChange({ ...row, pantoneNumber: value })}
                suggestions={suggestions?.pantone_numbers || []}
                onRemoveSuggestion={(value) => onRemoveSuggestion?.("pantone_number", value)}
                className={inputClass}
                placeholder="e.g. Pantone 186C"
              />
            </div>
          )}
        </div>
      )}

      {row.itemType && row.category === "Varnish" && (
        <div className="space-y-3">
          <div>
            <label className={labelClass}>Varnish Type</label>
            <select
              value={row.varnishType}
              onChange={(e) => onChange({ ...row, varnishType: e.target.value })}
              className={inputClass}
            >
              <option value="" disabled>
                Select...
              </option>
              {VARNISH_PRESETS[row.itemType].map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
          {row.varnishType === "Other" && (
            <div>
              <label className={labelClass}>Custom Varnish Type</label>
              <SuggestionInput
                value={row.varnishTypeOther}
                onChange={(value) => onChange({ ...row, varnishTypeOther: value })}
                suggestions={suggestions?.varnish_types || []}
                onRemoveSuggestion={(value) => onRemoveSuggestion?.("varnish_type", value)}
                className={inputClass}
                placeholder="Enter varnish type"
              />
            </div>
          )}
        </div>
      )}

      {row.category && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-charcoal">Box Groups</h4>
          {row.boxGroups.map((group, i) => (
            <div key={i} className="border border-sand rounded-lg p-3 bg-cream/30 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-rust">Group {i + 1}</span>
                {row.boxGroups.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeBoxGroup(i)}
                    className="p-1.5 rounded-lg hover:bg-cream text-rust transition-colors"
                    title="Remove Box Group"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className={labelClass}>Number of Boxes</label>
                  <NumberInput
                    value={group.numberOfBoxes}
                    onChange={(e) => updateBoxGroup(i, "numberOfBoxes", e.target.value)}
                    className={inputClass}
                    min={0}
                    step="1"
                  />
                </div>
                <div>
                  <label className={labelClass}>Containers Per Box</label>
                  <NumberInput
                    value={group.containersPerBox}
                    onChange={(e) => updateBoxGroup(i, "containersPerBox", e.target.value)}
                    className={inputClass}
                    min={0}
                    step="1"
                  />
                </div>
                <div>
                  <label className={labelClass}>Weight Per Container (kg)</label>
                  <NumberInput
                    value={group.weightPerContainer}
                    onChange={(e) => updateBoxGroup(i, "weightPerContainer", e.target.value)}
                    className={inputClass}
                    min={0}
                    step="0.01"
                  />
                </div>
              </div>
              <p className="text-xs text-taupe">
                Group Weight: <span className="font-semibold text-charcoal">{groupWeights[i].toFixed(2)} kg</span>
              </p>
            </div>
          ))}

          <button
            type="button"
            onClick={addBoxGroup}
            className="inline-flex items-center gap-2 border border-dashed border-taupe text-taupe rounded-lg px-4 py-2 text-sm font-medium hover:border-rust hover:text-rust transition-colors w-full justify-center"
          >
            <Plus size={16} />
            Add Another Box Group
          </button>

          <p className="text-sm text-charcoal bg-cream/60 border border-sand rounded-lg px-3 py-2">
            Grand Total Weight: <span className="font-semibold">{itemTotalWeight.toFixed(2)} kg</span>
          </p>
        </div>
      )}
    </div>
  );
}
