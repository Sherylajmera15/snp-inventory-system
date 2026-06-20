"use client";

import {
  OIL_OPTIONS,
  OilItem,
  OilItemInput,
  OilSuggestionCategory,
  OilSuggestions,
} from "@/types/oil";
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

export interface OilItemRow {
  oilName: string;
  oilNameOther: string;
  manufacturer: string;
  machineName: string;
  quantityGroups: QuantityGroupRow[];
}

export const emptyOilItem = (): OilItemRow => ({
  oilName: "",
  oilNameOther: "",
  manufacturer: "",
  machineName: "",
  quantityGroups: [emptyQuantityGroup()],
});

export function oilItemRowFromItem(item: OilItem): OilItemRow {
  const isKnown =
    (OIL_OPTIONS as readonly string[]).includes(item.oil_name) && item.oil_name !== "Other";
  return {
    oilName: isKnown ? item.oil_name : "Other",
    oilNameOther: isKnown ? "" : item.oil_name,
    manufacturer: item.manufacturer || "",
    machineName: item.machine_name || "",
    quantityGroups: item.quantity_groups?.length
      ? item.quantity_groups.map(quantityGroupRowFromOut)
      : [emptyQuantityGroup()],
  };
}

export function validateOilItemRow(
  row: OilItemRow
): { item: OilItemInput; error?: undefined } | { item?: undefined; error: string } {
  const finalName = row.oilName === "Other" ? row.oilNameOther.trim() : row.oilName;
  if (!finalName) return { error: "Please select or enter an Oil / Lubricant Name" };
  if (row.oilName === "Other" && !row.oilNameOther.trim())
    return { error: "Please enter a Custom Oil / Lubricant Name" };

  for (const g of row.quantityGroups) {
    if (
      !g.numberOfPacks ||
      !g.quantityPerPack ||
      parseFloat(g.numberOfPacks) <= 0 ||
      parseFloat(g.quantityPerPack) <= 0
    )
      return { error: "Number of Containers and Quantity Per Container are required for every group" };
    if (!effectiveUnit(g))
      return { error: "Unit is required for every quantity group" };
  }

  return {
    item: {
      oil_name: finalName,
      manufacturer: row.manufacturer.trim() || null,
      machine_name: row.machineName.trim() || null,
      quantity_groups: row.quantityGroups.map((g) => ({
        number_of_packs: parseFloat(g.numberOfPacks),
        quantity_per_pack: parseFloat(g.quantityPerPack),
        unit: effectiveUnit(g),
      })),
    },
  };
}

interface OilItemFieldsProps {
  row: OilItemRow;
  index: number;
  suggestions?: OilSuggestions;
  onRemoveSuggestion?: (category: OilSuggestionCategory, value: string) => void;
  onChange: (row: OilItemRow) => void;
  onRemove?: () => void;
}

export default function OilItemFields({
  row,
  index,
  suggestions,
  onRemoveSuggestion,
  onChange,
  onRemove,
}: OilItemFieldsProps) {
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
        <label className={labelClass}>Oil / Lubricant Name</label>
        <SearchableSelect
          options={OIL_OPTIONS}
          value={row.oilName}
          onChange={(v) => onChange({ ...row, oilName: v, oilNameOther: "" })}
          placeholder="Type to search oil or lubricant..."
          className={inputClass}
        />
      </div>

      {row.oilName === "Other" && (
        <div>
          <label className={labelClass}>Custom Oil / Lubricant Name</label>
          <SuggestionInput
            value={row.oilNameOther}
            onChange={(v) => onChange({ ...row, oilNameOther: v })}
            suggestions={suggestions?.custom_names || []}
            onRemoveSuggestion={(v) => onRemoveSuggestion?.("custom_name", v)}
            className={inputClass}
            placeholder="Enter oil or lubricant name"
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
          placeholder="e.g. Servo, Castrol, Shell"
        />
      </div>

      <div>
        <label className={labelClass}>Machine Name (optional)</label>
        <SuggestionInput
          value={row.machineName}
          onChange={(v) => onChange({ ...row, machineName: v })}
          suggestions={suggestions?.machine_names || []}
          onRemoveSuggestion={(v) => onRemoveSuggestion?.("machine_name", v)}
          className={inputClass}
          placeholder="e.g. CD102, SM74, Air Compressor"
        />
      </div>

      <QuantityGroupSection
        groups={row.quantityGroups}
        onChange={(groups) => onChange({ ...row, quantityGroups: groups })}
      />
    </div>
  );
}
