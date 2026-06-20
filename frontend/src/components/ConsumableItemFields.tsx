"use client";

import {
  CONSUMABLE_OPTIONS,
  ConsumableItemInput,
  ConsumableSuggestionCategory,
  ConsumableSuggestions,
} from "@/types/consumable";
import SuggestionInput from "./SuggestionInput";
import SearchableSelect from "./SearchableSelect";
import QuantityGroupSection, {
  QuantityGroupRow,
  emptyQuantityGroup,
  effectiveUnit,
  quantityGroupRowFromOut,
} from "./QuantityGroupSection";
import { Trash2 } from "lucide-react";

const inputClass =
  "w-full rounded-lg border border-sand bg-cream/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust";
const labelClass = "block text-sm font-medium text-charcoal mb-1";

export interface ConsumableItemRow {
  consumableName: string;
  consumableNameOther: string;
  manufacturer: string;
  quantityGroups: QuantityGroupRow[];
}

export const emptyConsumableItem = (): ConsumableItemRow => ({
  consumableName: "",
  consumableNameOther: "",
  manufacturer: "",
  quantityGroups: [emptyQuantityGroup()],
});

export function consumableItemRowFromItem(item: ConsumableItemInput): ConsumableItemRow {
  const isKnown =
    (CONSUMABLE_OPTIONS as readonly string[]).includes(item.consumable_name) &&
    item.consumable_name !== "Other";
  return {
    consumableName: isKnown ? item.consumable_name : "Other",
    consumableNameOther: isKnown ? "" : item.consumable_name,
    manufacturer: item.manufacturer || "",
    quantityGroups: item.quantity_groups?.length
      ? item.quantity_groups.map(quantityGroupRowFromOut)
      : [emptyQuantityGroup()],
  };
}

export function validateConsumableItemRow(
  row: ConsumableItemRow
): { item: ConsumableItemInput; error?: undefined } | { item?: undefined; error: string } {
  const finalName =
    row.consumableName === "Other" ? row.consumableNameOther.trim() : row.consumableName;
  if (!finalName) return { error: "Please select or enter a Consumable Name" };
  if (row.consumableName === "Other" && !row.consumableNameOther.trim())
    return { error: "Please enter a Custom Consumable Name" };

  for (const g of row.quantityGroups) {
    if (
      !g.numberOfPacks ||
      !g.quantityPerPack ||
      parseFloat(g.numberOfPacks) <= 0 ||
      parseFloat(g.quantityPerPack) <= 0
    )
      return { error: "Number of Packs and Quantity Per Pack are required for every group" };
    if (!effectiveUnit(g))
      return { error: "Unit is required for every quantity group" };
  }

  return {
    item: {
      consumable_name: finalName,
      manufacturer: row.manufacturer.trim() || null,
      quantity_groups: row.quantityGroups.map((g) => ({
        number_of_packs: parseFloat(g.numberOfPacks),
        quantity_per_pack: parseFloat(g.quantityPerPack),
        unit: effectiveUnit(g),
      })),
    },
  };
}

interface ConsumableItemFieldsProps {
  row: ConsumableItemRow;
  index: number;
  suggestions?: ConsumableSuggestions;
  onRemoveSuggestion?: (category: ConsumableSuggestionCategory, value: string) => void;
  onChange: (row: ConsumableItemRow) => void;
  onRemove?: () => void;
}

export default function ConsumableItemFields({
  row,
  index,
  suggestions,
  onRemoveSuggestion,
  onChange,
  onRemove,
}: ConsumableItemFieldsProps) {
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

      <div>
        <label className={labelClass}>Consumable Name</label>
        <SearchableSelect
          options={CONSUMABLE_OPTIONS}
          value={row.consumableName}
          onChange={(v) => onChange({ ...row, consumableName: v, consumableNameOther: "" })}
          placeholder="Type to search consumable..."
          className={inputClass}
        />
      </div>

      {row.consumableName === "Other" && (
        <div>
          <label className={labelClass}>Custom Consumable Name</label>
          <SuggestionInput
            value={row.consumableNameOther}
            onChange={(v) => onChange({ ...row, consumableNameOther: v })}
            suggestions={suggestions?.custom_names || []}
            onRemoveSuggestion={(v) => onRemoveSuggestion?.("custom_name", v)}
            className={inputClass}
            placeholder="Enter consumable name"
          />
        </div>
      )}

      <div>
        <label className={labelClass}>Manufacturer / Brand (optional)</label>
        <SuggestionInput
          value={row.manufacturer}
          onChange={(v) => onChange({ ...row, manufacturer: v })}
          suggestions={suggestions?.manufacturers || []}
          onRemoveSuggestion={(v) => onRemoveSuggestion?.("manufacturer", v)}
          className={inputClass}
          placeholder="e.g. Bachem, Servo, Cito"
        />
      </div>

      <QuantityGroupSection
        groups={row.quantityGroups}
        onChange={(groups) => onChange({ ...row, quantityGroups: groups })}
      />
    </div>
  );
}
