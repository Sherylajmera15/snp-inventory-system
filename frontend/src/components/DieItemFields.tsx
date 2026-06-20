"use client";

import NumberInput from "./NumberInput";
import SuggestionInput from "./SuggestionInput";
import { DiesSuggestions, DiesSuggestionCategory } from "@/types/dies";
import { Trash2 } from "lucide-react";

export interface DieItemRow {
  dieNumber: string;
  jobName: string;
  ups: string;
  embossing: string;
  femaleBlock: string;
  rubberized: string;
  length: string;
  width: string;
  height: string;
  storageLocation: string;
}

export function emptyDieItem(): DieItemRow {
  return {
    dieNumber: "",
    jobName: "",
    ups: "",
    embossing: "",
    femaleBlock: "",
    rubberized: "",
    length: "",
    width: "",
    height: "",
    storageLocation: "",
  };
}

export function dieItemRowFromItem(item: import("@/types/dies").DieItem): DieItemRow {
  return {
    dieNumber: item.die_number,
    jobName: item.job_name,
    ups: String(item.ups),
    embossing: item.embossing,
    femaleBlock: item.female_block || "",
    rubberized: item.rubberized,
    length: item.length != null ? String(item.length) : "",
    width: item.width != null ? String(item.width) : "",
    height: item.height != null ? String(item.height) : "",
    storageLocation: item.storage_location || "",
  };
}

export function validateDieItemRow(
  row: DieItemRow,
  index: number
): { payload: Record<string, unknown> } | { error: string } {
  const label = `Die #${index + 1}`;
  if (!row.dieNumber.trim()) return { error: `${label}: Die Number is required` };
  if (!row.jobName.trim()) return { error: `${label}: Job Name is required` };
  const ups = parseInt(row.ups, 10);
  if (!ups || ups <= 0) return { error: `${label}: UPS must be a positive number` };
  if (!row.embossing) return { error: `${label}: Embossing selection is required` };
  if (row.embossing === "Yes" && !row.femaleBlock)
    return { error: `${label}: Female Block selection is required when Embossing is Yes` };
  if (!row.rubberized) return { error: `${label}: Rubberized selection is required` };

  return {
    payload: {
      die_number: row.dieNumber.trim(),
      job_name: row.jobName.trim(),
      ups,
      embossing: row.embossing,
      female_block: row.embossing === "Yes" ? row.femaleBlock || null : null,
      rubberized: row.rubberized,
      length: row.length ? parseFloat(row.length) : null,
      width: row.width ? parseFloat(row.width) : null,
      height: row.height ? parseFloat(row.height) : null,
      storage_location: row.storageLocation.trim() || null,
    },
  };
}

const inputClass =
  "w-full rounded-lg border border-sand bg-cream/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust";
const labelClass = "block text-xs font-medium text-taupe mb-1 uppercase tracking-wide";
const selectClass =
  "w-full rounded-lg border border-sand bg-cream/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust";

interface DieItemFieldsProps {
  index: number;
  row: DieItemRow;
  suggestions: DiesSuggestions | undefined;
  onChange: (updated: DieItemRow) => void;
  onRemove: () => void;
  canRemove: boolean;
  onRemoveSuggestion: (cat: DiesSuggestionCategory, value: string) => void;
}

export default function DieItemFields({
  index,
  row,
  suggestions,
  onChange,
  onRemove,
  canRemove,
  onRemoveSuggestion,
}: DieItemFieldsProps) {
  const set = (field: keyof DieItemRow, value: string) =>
    onChange({ ...row, [field]: value });

  return (
    <div className="border border-sand rounded-xl p-4 space-y-4 bg-white">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-taupe uppercase tracking-wide">
          Die #{index + 1}
        </span>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="text-rust hover:text-rust/70 transition-colors"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>

      {/* Die Number + Job Name */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Die Number *</label>
          <input
            className={inputClass}
            value={row.dieNumber}
            onChange={(e) => set("dieNumber", e.target.value)}
            placeholder="e.g. D-1025"
          />
        </div>
        <div>
          <label className={labelClass}>Job Name *</label>
          <SuggestionInput
            value={row.jobName}
            onChange={(v) => set("jobName", v)}
            suggestions={suggestions?.job_names ?? []}
            onRemoveSuggestion={(v) => onRemoveSuggestion("job_name", v)}
            placeholder="e.g. Amul Butter"
          />
        </div>
      </div>

      {/* UPS + Embossing + Rubberized */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div>
          <label className={labelClass}>UPS *</label>
          <NumberInput
            value={row.ups}
            onChange={(e) => set("ups", e.target.value)}
            placeholder="e.g. 4"
            step={1}
          />
        </div>
        <div>
          <label className={labelClass}>Embossing *</label>
          <select
            className={selectClass}
            value={row.embossing}
            onChange={(e) => set("embossing", e.target.value)}
          >
            <option value="">Select</option>
            <option value="Yes">Yes</option>
            <option value="No">No</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Rubberized *</label>
          <select
            className={selectClass}
            value={row.rubberized}
            onChange={(e) => set("rubberized", e.target.value)}
          >
            <option value="">Select</option>
            <option value="Yes">Yes</option>
            <option value="No">No</option>
          </select>
        </div>
      </div>

      {/* Female Block (only when Embossing = Yes) */}
      {row.embossing === "Yes" && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>Female Block *</label>
            <select
              className={selectClass}
              value={row.femaleBlock}
              onChange={(e) => set("femaleBlock", e.target.value)}
            >
              <option value="">Select</option>
              <option value="Yes">Yes</option>
              <option value="No">No</option>
            </select>
          </div>
        </div>
      )}

      {/* Dimensions (optional) */}
      <div>
        <p className={labelClass}>Dimensions (optional)</p>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-taupe mb-1">Length (mm)</label>
            <NumberInput
              value={row.length}
              onChange={(e) => set("length", e.target.value)}
              placeholder="L"
            />
          </div>
          <div>
            <label className="block text-xs text-taupe mb-1">Width (mm)</label>
            <NumberInput
              value={row.width}
              onChange={(e) => set("width", e.target.value)}
              placeholder="W"
            />
          </div>
          <div>
            <label className="block text-xs text-taupe mb-1">Height (mm)</label>
            <NumberInput
              value={row.height}
              onChange={(e) => set("height", e.target.value)}
              placeholder="H"
            />
          </div>
        </div>
      </div>

      {/* Storage Location (optional) */}
      <div>
        <label className={labelClass}>Storage Location (optional)</label>
        <SuggestionInput
          value={row.storageLocation}
          onChange={(v) => set("storageLocation", v)}
          suggestions={suggestions?.storage_locations ?? []}
          onRemoveSuggestion={(v) => onRemoveSuggestion("storage_location", v)}
          placeholder="e.g. Rack A, Shelf 2"
        />
      </div>
    </div>
  );
}
