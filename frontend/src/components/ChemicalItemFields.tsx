"use client";

import {
  CHEMICAL_OPTIONS,
  ChemicalItemInput,
  ChemicalSuggestionCategory,
  ChemicalSuggestions,
} from "@/types/chemical";
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

export interface ChemicalItemRow {
  chemicalName: string;
  chemicalNameOther: string;
  manufacturer: string;
  quantityGroups: QuantityGroupRow[];
}

export const emptyChemicalItem = (): ChemicalItemRow => ({
  chemicalName: "",
  chemicalNameOther: "",
  manufacturer: "",
  quantityGroups: [emptyQuantityGroup()],
});

export function chemicalItemRowFromItem(item: ChemicalItemInput): ChemicalItemRow {
  const isKnown =
    (CHEMICAL_OPTIONS as readonly string[]).includes(item.chemical_name) &&
    item.chemical_name !== "Other";
  return {
    chemicalName: isKnown ? item.chemical_name : "Other",
    chemicalNameOther: isKnown ? "" : item.chemical_name,
    manufacturer: item.manufacturer || "",
    quantityGroups: item.quantity_groups?.length
      ? item.quantity_groups.map(quantityGroupRowFromOut)
      : [emptyQuantityGroup()],
  };
}

export function validateChemicalItemRow(
  row: ChemicalItemRow
): { item: ChemicalItemInput; error?: undefined } | { item?: undefined; error: string } {
  const finalName =
    row.chemicalName === "Other" ? row.chemicalNameOther.trim() : row.chemicalName;
  if (!finalName) return { error: "Please select or enter a Chemical Name" };
  if (row.chemicalName === "Other" && !row.chemicalNameOther.trim())
    return { error: "Please enter a Custom Chemical Name" };

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
      chemical_name: finalName,
      manufacturer: row.manufacturer.trim() || null,
      quantity_groups: row.quantityGroups.map((g) => ({
        number_of_packs: parseFloat(g.numberOfPacks),
        quantity_per_pack: parseFloat(g.quantityPerPack),
        unit: effectiveUnit(g),
      })),
    },
  };
}

interface ChemicalItemFieldsProps {
  row: ChemicalItemRow;
  index: number;
  suggestions?: ChemicalSuggestions;
  onRemoveSuggestion?: (category: ChemicalSuggestionCategory, value: string) => void;
  onChange: (row: ChemicalItemRow) => void;
  onRemove?: () => void;
}

export default function ChemicalItemFields({
  row,
  index,
  suggestions,
  onRemoveSuggestion,
  onChange,
  onRemove,
}: ChemicalItemFieldsProps) {
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
        <label className={labelClass}>Chemical Name</label>
        <SearchableSelect
          options={CHEMICAL_OPTIONS}
          value={row.chemicalName}
          onChange={(v) => onChange({ ...row, chemicalName: v, chemicalNameOther: "" })}
          placeholder="Type to search chemical..."
          className={inputClass}
        />
      </div>

      {row.chemicalName === "Other" && (
        <div>
          <label className={labelClass}>Custom Chemical Name</label>
          <SuggestionInput
            value={row.chemicalNameOther}
            onChange={(v) => onChange({ ...row, chemicalNameOther: v })}
            suggestions={suggestions?.custom_names || []}
            onRemoveSuggestion={(v) => onRemoveSuggestion?.("custom_name", v)}
            className={inputClass}
            placeholder="Enter chemical name"
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
          placeholder="e.g. Pidilite, Bachem"
        />
      </div>

      <QuantityGroupSection
        groups={row.quantityGroups}
        onChange={(groups) => onChange({ ...row, quantityGroups: groups })}
      />
    </div>
  );
}
