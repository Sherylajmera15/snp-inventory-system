"use client";

import { useId } from "react";
import NumberInput from "./NumberInput";
import SuggestionInput from "./SuggestionInput";
import {
  BundleGroupInput,
  PaperItemInput,
  PaperSuggestions,
  QUALITY_OPTIONS,
  SuggestionCategory,
  FormType,
} from "@/types/paper";
import { Trash2 } from "lucide-react";

const inputClass =
  "w-full rounded-lg border border-sand bg-cream/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust";
const labelClass = "block text-sm font-medium text-charcoal mb-1";

export interface BundleGroupRow {
  bundles: string;
  packets: string;
  sheets: string;
}

export interface PaperItemRow {
  quality: string;
  qualityOther: string;
  gsm: string;
  formType: FormType | "";
  reelWidth: string;
  numberOfReels: string;
  reelWeights: string[];
  sheetLength: string;
  sheetWidth: string;
  bundleGroups: BundleGroupRow[];
}

export const emptyBundleGroup = (): BundleGroupRow => ({ bundles: "", packets: "", sheets: "" });

export const emptyPaperItem = (): PaperItemRow => ({
  quality: "",
  qualityOther: "",
  gsm: "",
  formType: "",
  reelWidth: "",
  numberOfReels: "",
  reelWeights: [],
  sheetLength: "",
  sheetWidth: "",
  bundleGroups: [emptyBundleGroup()],
});

export function paperItemRowFromItem(item: PaperItemInput): PaperItemRow {
  const knownQuality = (QUALITY_OPTIONS as readonly string[]).includes(item.quality);
  return {
    quality: knownQuality ? item.quality : "Other",
    qualityOther: knownQuality ? "" : item.quality,
    gsm: item.gsm != null ? String(item.gsm) : "",
    formType: item.form_type || "",
    reelWidth: item.reel_width != null ? String(item.reel_width) : "",
    numberOfReels: item.reel_weights?.length ? String(item.reel_weights.length) : "",
    reelWeights: item.reel_weights?.map((w) => String(w)) || [],
    sheetLength: item.sheet_length != null ? String(item.sheet_length) : "",
    sheetWidth: item.sheet_width != null ? String(item.sheet_width) : "",
    bundleGroups: item.bundle_groups?.length
      ? item.bundle_groups.map((g) => ({
          bundles: String(g.number_of_bundles),
          packets: String(g.packets_per_bundle),
          sheets: String(g.sheets_per_packet),
        }))
      : [emptyBundleGroup()],
  };
}

export function validatePaperItemRow(row: PaperItemRow): { item: PaperItemInput; error?: undefined } | { item?: undefined; error: string } {
  const finalQuality = row.quality === "Other" ? row.qualityOther.trim() : row.quality;
  if (!finalQuality) return { error: "Quality is required" };
  if (!row.gsm) return { error: "GSM is required" };
  if (!row.formType) return { error: "Form Type is required" };

  const item: PaperItemInput = {
    quality: finalQuality,
    gsm: parseInt(row.gsm, 10),
    form_type: row.formType,
  };

  if (row.formType === "Reel Form") {
    if (!row.reelWidth) return { error: "Reel Width is required" };
    if (!row.numberOfReels || parseInt(row.numberOfReels, 10) < 1) return { error: "Number of Reels is required" };
    if (row.reelWeights.some((w) => !w)) return { error: "Please enter the weight for every reel" };
    item.reel_width = parseFloat(row.reelWidth);
    item.reel_weights = row.reelWeights.map((w) => parseFloat(w));
  } else {
    if (!row.sheetLength || !row.sheetWidth) return { error: "Length and Width are required" };
    if (
      row.bundleGroups.some(
        (g) => !g.bundles || !g.packets || !g.sheets || parseInt(g.bundles, 10) <= 0 ||
          parseInt(g.packets, 10) <= 0 || parseInt(g.sheets, 10) <= 0
      )
    ) {
      return { error: "Each bundle group requires Number of Bundles, Packets per Bundle and Sheets per Packet" };
    }
    item.sheet_length = parseFloat(row.sheetLength);
    item.sheet_width = parseFloat(row.sheetWidth);
    item.bundle_groups = row.bundleGroups.map(
      (g): BundleGroupInput => ({
        number_of_bundles: parseInt(g.bundles, 10),
        packets_per_bundle: parseInt(g.packets, 10),
        sheets_per_packet: parseInt(g.sheets, 10),
      })
    );
  }

  return { item };
}

interface PaperItemFieldsProps {
  row: PaperItemRow;
  index: number;
  suggestions?: PaperSuggestions;
  onRemoveSuggestion?: (category: SuggestionCategory, value: string) => void;
  onChange: (row: PaperItemRow) => void;
  onRemove?: () => void;
}

export default function PaperItemFields({ row, index, suggestions, onRemoveSuggestion, onChange, onRemove }: PaperItemFieldsProps) {
  const idPrefix = useId();

  const totalReelWeight = row.reelWeights
    .reduce((sum, w) => sum + (parseFloat(w) || 0), 0)
    .toFixed(2);

  const groupTotals = row.bundleGroups.map(
    (g) => (parseInt(g.bundles, 10) || 0) * (parseInt(g.packets, 10) || 0) * (parseInt(g.sheets, 10) || 0)
  );
  const overallTotalSheets = groupTotals.reduce((sum, t) => sum + t, 0);
  const calculatedSheetWeight = (
    ((((parseFloat(row.sheetLength) || 0) * (parseFloat(row.sheetWidth) || 0) * (parseInt(row.gsm, 10) || 0)) / 20000) / 500) *
    overallTotalSheets
  ).toFixed(2);

  const customQualitySuggestions = (suggestions?.qualities || []).filter(
    (q) => !(QUALITY_OPTIONS as readonly string[]).includes(q)
  );

  const handleNumberOfReelsChange = (value: string) => {
    const n = parseInt(value, 10);
    if (!n || n < 1) {
      onChange({ ...row, numberOfReels: value, reelWeights: [] });
      return;
    }
    const next = [...row.reelWeights];
    next.length = n;
    const weights = Array.from({ length: n }, (_, i) => next[i] ?? "");
    onChange({ ...row, numberOfReels: value, reelWeights: weights });
  };

  const updateBundleGroup = (i: number, field: keyof BundleGroupRow, value: string) => {
    const next = [...row.bundleGroups];
    next[i] = { ...next[i], [field]: value };
    onChange({ ...row, bundleGroups: next });
  };

  const addBundleGroup = () => onChange({ ...row, bundleGroups: [...row.bundleGroups, emptyBundleGroup()] });

  const removeBundleGroup = (i: number) => onChange({ ...row, bundleGroups: row.bundleGroups.filter((_, idx) => idx !== i) });

  return (
    <div className="border border-sand rounded-2xl p-5 bg-cream/30 space-y-4">
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Quality</label>
          <select
            value={row.quality}
            onChange={(e) => onChange({ ...row, quality: e.target.value })}
            className={inputClass}
          >
            <option value="" disabled>
              Select quality...
            </option>
            {QUALITY_OPTIONS.map((q) => (
              <option key={q} value={q}>
                {q}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>GSM</label>
          <SuggestionInput
            type="number"
            value={row.gsm}
            onChange={(v) => onChange({ ...row, gsm: v })}
            className={inputClass}
            min={0}
            suggestions={(suggestions?.gsm_values || []).map((v) => String(v))}
            onRemoveSuggestion={(value) => onRemoveSuggestion?.("gsm", value)}
          />
        </div>
      </div>

      {row.quality === "Other" && (
        <div>
          <label className={labelClass}>Specify Quality</label>
          <input
            type="text"
            value={row.qualityOther}
            onChange={(e) => onChange({ ...row, qualityOther: e.target.value })}
            className={inputClass}
            placeholder="Enter quality name"
            list={`${idPrefix}-quality-suggestions`}
          />
          <datalist id={`${idPrefix}-quality-suggestions`}>
            {customQualitySuggestions.map((q) => (
              <option key={q} value={q} />
            ))}
          </datalist>
        </div>
      )}

      {/* Form Type */}
      <div>
        <label className={labelClass}>Form Type</label>
        <div className="flex gap-3">
          {(["Reel Form", "Sheet Form"] as FormType[]).map((ft) => (
            <button
              key={ft}
              type="button"
              onClick={() => onChange({ ...row, formType: ft })}
              className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                row.formType === ft
                  ? "bg-rust text-white border-rust"
                  : "bg-white text-charcoal border-sand hover:border-rust"
              }`}
            >
              {ft}
            </button>
          ))}
        </div>
      </div>

      {row.formType === "Reel Form" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Reel Width (cm)</label>
              <NumberInput
                value={row.reelWidth}
                onChange={(e) => onChange({ ...row, reelWidth: e.target.value })}
                className={inputClass}
                min={0}
                step="0.01"
              />
            </div>
            <div>
              <label className={labelClass}>Number of Reels</label>
              <NumberInput
                value={row.numberOfReels}
                onChange={(e) => handleNumberOfReelsChange(e.target.value)}
                className={inputClass}
                min={1}
                step="1"
              />
            </div>
          </div>

          {row.reelWeights.length > 0 && (
            <div>
              <label className={labelClass}>Reel Weights (kg)</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {row.reelWeights.map((w, i) => (
                  <div key={i}>
                    <span className="text-xs text-taupe">Reel {i + 1}</span>
                    <NumberInput
                      value={w}
                      onChange={(e) => {
                        const next = [...row.reelWeights];
                        next[i] = e.target.value;
                        onChange({ ...row, reelWeights: next });
                      }}
                      className={inputClass}
                      min={0}
                      step="0.01"
                    />
                  </div>
                ))}
              </div>
              <p className="text-sm text-charcoal mt-3">
                Total Reel Weight: <span className="font-semibold">{totalReelWeight} kg</span>
              </p>
            </div>
          )}
        </div>
      )}

      {row.formType === "Sheet Form" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Length (cm)</label>
              <NumberInput
                value={row.sheetLength}
                onChange={(e) => onChange({ ...row, sheetLength: e.target.value })}
                className={inputClass}
                min={0}
                step="0.01"
              />
            </div>
            <div>
              <label className={labelClass}>Width (cm)</label>
              <NumberInput
                value={row.sheetWidth}
                onChange={(e) => onChange({ ...row, sheetWidth: e.target.value })}
                className={inputClass}
                min={0}
                step="0.01"
              />
            </div>
          </div>

          <div className="space-y-3">
            <label className={labelClass}>Bundle Groups</label>
            {row.bundleGroups.map((group, i) => (
              <div key={i} className="border border-sand rounded-lg p-3 bg-white space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-rust">
                    Bundle Group {i + 1}
                  </span>
                  {row.bundleGroups.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeBundleGroup(i)}
                      className="p-1.5 rounded-lg hover:bg-cream text-rust transition-colors"
                      title="Remove Bundle Group"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <span className="text-xs text-taupe">Number of Bundles</span>
                    <NumberInput
                      value={group.bundles}
                      onChange={(e) => updateBundleGroup(i, "bundles", e.target.value)}
                      className={inputClass}
                      min={0}
                      step="1"
                    />
                  </div>
                  <div>
                    <span className="text-xs text-taupe">Packets per Bundle</span>
                    <NumberInput
                      value={group.packets}
                      onChange={(e) => updateBundleGroup(i, "packets", e.target.value)}
                      className={inputClass}
                      min={0}
                      step="1"
                    />
                  </div>
                  <div>
                    <span className="text-xs text-taupe">Sheets per Packet</span>
                    <NumberInput
                      value={group.sheets}
                      onChange={(e) => updateBundleGroup(i, "sheets", e.target.value)}
                      className={inputClass}
                      min={0}
                      step="1"
                    />
                  </div>
                </div>
                <p className="text-xs text-taupe">
                  Group Total Sheets: <span className="font-semibold text-charcoal">{groupTotals[i]}</span>
                </p>
              </div>
            ))}
            <button
              type="button"
              onClick={addBundleGroup}
              className="inline-flex items-center gap-2 border border-dashed border-taupe text-taupe rounded-lg px-4 py-2 text-sm font-medium hover:border-rust hover:text-rust transition-colors w-full justify-center"
            >
              Add Another Bundle Group
            </button>
          </div>

          <div className="bg-cream/60 border border-sand rounded-lg p-3 space-y-1">
            <p className="text-sm text-charcoal">
              Overall Total Sheets: <span className="font-semibold">{overallTotalSheets}</span>
            </p>
            <p className="text-sm text-charcoal">
              Calculated Sheet Weight: <span className="font-semibold">{calculatedSheetWeight} kg</span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
