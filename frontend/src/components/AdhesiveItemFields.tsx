"use client";

import {
  ADHESIVE_OPTIONS,
  AdhesiveItemInput,
  AdhesiveSuggestionCategory,
  AdhesiveSuggestions,
} from "@/types/adhesive";
import SuggestionInput from "./SuggestionInput";
import SearchableSelect from "./SearchableSelect";
import QuantityGroupSection, {
  QuantityGroupRow,
  emptyQuantityGroup,
  effectiveUnit,
  groupQuantityFor,
  quantityGroupRowFromOut,
} from "./QuantityGroupSection";
import { Trash2 } from "lucide-react";

const inputClass =
  "w-full rounded-lg border border-sand bg-cream/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust";
const labelClass = "block text-sm font-medium text-charcoal mb-1";

export interface AdhesiveItemRow {
  adhesiveName: string;
  adhesiveNameOther: string;
  manufacturer: string;
  quantityGroups: QuantityGroupRow[];
}

export const emptyAdhesiveItem = (): AdhesiveItemRow => ({
  adhesiveName: "",
  adhesiveNameOther: "",
  manufacturer: "",
  quantityGroups: [emptyQuantityGroup()],
});

export function adhesiveItemRowFromItem(item: AdhesiveItemInput): AdhesiveItemRow {
  const isKnown =
    (ADHESIVE_OPTIONS as readonly string[]).includes(item.adhesive_name) &&
    item.adhesive_name !== "Other";
  return {
    adhesiveName: isKnown ? item.adhesive_name : "Other",
    adhesiveNameOther: isKnown ? "" : item.adhesive_name,
    manufacturer: item.manufacturer || "",
    quantityGroups: item.quantity_groups?.length
      ? item.quantity_groups.map(quantityGroupRowFromOut)
      : [emptyQuantityGroup()],
  };
}

export function validateAdhesiveItemRow(
  row: AdhesiveItemRow
): { item: AdhesiveItemInput; error?: undefined } | { item?: undefined; error: string } {
  const finalName =
    row.adhesiveName === "Other" ? row.adhesiveNameOther.trim() : row.adhesiveName;
  if (!finalName) return { error: "Please select or enter an Adhesive Name" };
  if (row.adhesiveName === "Other" && !row.adhesiveNameOther.trim())
    return { error: "Please enter a Custom Adhesive Name" };

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
      adhesive_name: finalName,
      manufacturer: row.manufacturer.trim() || null,
      quantity_groups: row.quantityGroups.map((g) => ({
        number_of_packs: parseFloat(g.numberOfPacks),
        quantity_per_pack: parseFloat(g.quantityPerPack),
        unit: effectiveUnit(g),
      })),
    },
  };
}

interface AdhesiveItemFieldsProps {
  row: AdhesiveItemRow;
  index: number;
  suggestions?: AdhesiveSuggestions;
  onRemoveSuggestion?: (category: AdhesiveSuggestionCategory, value: string) => void;
  onChange: (row: AdhesiveItemRow) => void;
  onRemove?: () => void;
}

export default function AdhesiveItemFields({
  row,
  index,
  suggestions,
  onRemoveSuggestion,
  onChange,
  onRemove,
}: AdhesiveItemFieldsProps) {
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
        <label className={labelClass}>Adhesive Name</label>
        <SearchableSelect
          options={ADHESIVE_OPTIONS}
          value={row.adhesiveName}
          onChange={(v) => onChange({ ...row, adhesiveName: v, adhesiveNameOther: "" })}
          placeholder="Type to search adhesive..."
          className={inputClass}
        />
      </div>

      {row.adhesiveName === "Other" && (
        <div>
          <label className={labelClass}>Custom Adhesive Name</label>
          <SuggestionInput
            value={row.adhesiveNameOther}
            onChange={(v) => onChange({ ...row, adhesiveNameOther: v })}
            suggestions={suggestions?.custom_names || []}
            onRemoveSuggestion={(v) => onRemoveSuggestion?.("custom_name", v)}
            className={inputClass}
            placeholder="Enter adhesive name"
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
          placeholder="e.g. Pidilite, Henkel"
        />
      </div>

      <QuantityGroupSection
        groups={row.quantityGroups}
        onChange={(groups) => onChange({ ...row, quantityGroups: groups })}
      />
    </div>
  );
}
