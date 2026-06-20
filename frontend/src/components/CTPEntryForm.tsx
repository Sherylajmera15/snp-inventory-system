"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import {
  CTPInwardDetail,
  CTPInwardInput,
  CTPSuggestionCategory,
  CTPSuggestions,
  CTP_CHECKED_RECEIVED_BY_OPTIONS,
  PLATE_SIZE_OPTIONS,
  PlateSizeInput,
} from "@/types/ctp";
import NumberInput from "./NumberInput";
import SuggestionInput from "./SuggestionInput";
import { Plus, Trash2 } from "lucide-react";

const inputClass =
  "w-full rounded-lg border border-sand bg-cream/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust";
const labelClass = "block text-sm font-medium text-charcoal mb-1";

const PRESET_DIMENSIONS: Record<string, { length: number; width: number }> = {
  "770 x 1030 mm": { length: 770, width: 1030 },
  "800 x 1030 mm": { length: 800, width: 1030 },
};

interface PlateSizeRow {
  plateSize: string;
  lengthMm: string;
  widthMm: string;
  totalPackets: string;
  platesPerPacket: string;
}

const emptyPlateSize = (): PlateSizeRow => ({
  plateSize: "",
  lengthMm: "",
  widthMm: "",
  totalPackets: "",
  platesPerPacket: "",
});

function getTodayDate() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getCurrentTime() {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

interface CTPEntryFormProps {
  initialData?: CTPInwardDetail;
  onSaved: (id: number) => void;
  onCancel?: () => void;
}

export default function CTPEntryForm({ initialData, onSaved, onCancel }: CTPEntryFormProps) {
  const [inwardDate, setInwardDate] = useState(initialData?.inward_date || getTodayDate());
  const [inwardTime, setInwardTime] = useState(
    initialData?.inward_time ? initialData.inward_time.slice(0, 5) : getCurrentTime()
  );
  const [supplierName, setSupplierName] = useState(initialData?.supplier_name || "");
  const [invoiceNumber, setInvoiceNumber] = useState(initialData?.invoice_number || "");
  const [remarks, setRemarks] = useState(initialData?.remarks || "");

  const initialCheckedByIsKnown =
    !!initialData?.checked_received_by &&
    (CTP_CHECKED_RECEIVED_BY_OPTIONS as readonly string[]).includes(initialData.checked_received_by);
  const [checkedReceivedBy, setCheckedReceivedBy] = useState(
    initialData ? (initialCheckedByIsKnown ? initialData.checked_received_by! : "Other") : ""
  );
  const [checkedReceivedByOther, setCheckedReceivedByOther] = useState(
    initialData && !initialCheckedByIsKnown ? initialData.checked_received_by || "" : ""
  );

  const [plateSizes, setPlateSizes] = useState<PlateSizeRow[]>(
    initialData?.plate_sizes?.length
      ? initialData.plate_sizes.map((p) => ({
          plateSize: p.plate_size,
          lengthMm: p.plate_size === "Other" ? String(p.length_mm) : "",
          widthMm: p.plate_size === "Other" ? String(p.width_mm) : "",
          totalPackets: String(p.total_packets),
          platesPerPacket: String(p.plates_per_packet),
        }))
      : [emptyPlateSize()]
  );

  const [suggestions, setSuggestions] = useState<CTPSuggestions | undefined>(undefined);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get<CTPSuggestions>("/api/ctp/suggestions")
      .then((res) => setSuggestions(res.data))
      .catch(() => {});
  }, []);

  const handleRemoveSuggestion = (category: CTPSuggestionCategory, value: string) => {
    setSuggestions((prev) => {
      if (!prev) return prev;
      const field = category === "supplier_name" ? "supplier_names" : "checked_received_by";
      return { ...prev, [field]: prev[field].filter((v) => v !== value) };
    });
    api.delete(`/api/ctp/suggestions/${category}/${encodeURIComponent(value)}`).catch(() => {});
  };

  const dimensionsFor = (row: PlateSizeRow) => {
    if (row.plateSize in PRESET_DIMENSIONS) return PRESET_DIMENSIONS[row.plateSize];
    return { length: parseFloat(row.lengthMm) || 0, width: parseFloat(row.widthMm) || 0 };
  };

  const totalsFor = (row: PlateSizeRow) =>
    (parseInt(row.totalPackets, 10) || 0) * (parseInt(row.platesPerPacket, 10) || 0);

  const plateTotals = plateSizes.map(totalsFor);
  const grandTotal = plateTotals.reduce((sum, t) => sum + t, 0);

  const updatePlateSize = (index: number, field: keyof PlateSizeRow, value: string) => {
    const next = [...plateSizes];
    next[index] = { ...next[index], [field]: value };
    setPlateSizes(next);
  };

  const addPlateSize = () => setPlateSizes([...plateSizes, emptyPlateSize()]);
  const removePlateSize = (index: number) => setPlateSizes(plateSizes.filter((_, i) => i !== index));

  const handleSubmit = async () => {
    setError("");

    if (!supplierName.trim()) {
      setError("Supplier Name is required");
      return;
    }

    for (const row of plateSizes) {
      if (!row.plateSize) {
        setError("Please select a Plate Size for every section");
        return;
      }
      if (
        row.plateSize === "Other" &&
        (!row.lengthMm || !row.widthMm || parseFloat(row.lengthMm) <= 0 || parseFloat(row.widthMm) <= 0)
      ) {
        setError("Length and Width are required for a custom plate size");
        return;
      }
      if (
        !row.totalPackets ||
        !row.platesPerPacket ||
        parseInt(row.totalPackets, 10) <= 0 ||
        parseInt(row.platesPerPacket, 10) <= 0
      ) {
        setError("Total Packets and Plates Per Packet are required for every plate size");
        return;
      }
    }

    const finalCheckedBy = checkedReceivedBy === "Other" ? checkedReceivedByOther.trim() : checkedReceivedBy;
    if (!finalCheckedBy) {
      setError("Checked and Received By is required");
      return;
    }

    const payload: CTPInwardInput = {
      inward_date: inwardDate,
      inward_time: inwardTime,
      supplier_name: supplierName.trim(),
      invoice_number: invoiceNumber.trim() || null,
      checked_received_by: finalCheckedBy,
      remarks: remarks.trim() || null,
      plate_sizes: plateSizes.map((row): PlateSizeInput => {
        const dims = dimensionsFor(row);
        return {
          plate_size: row.plateSize,
          length_mm: row.plateSize === "Other" ? dims.length : null,
          width_mm: row.plateSize === "Other" ? dims.width : null,
          total_packets: parseInt(row.totalPackets, 10),
          plates_per_packet: parseInt(row.platesPerPacket, 10),
        };
      }),
    };

    setSaving(true);
    try {
      let res;
      if (initialData) {
        res = await api.put(`/api/ctp/${initialData.id}`, payload);
      } else {
        res = await api.post("/api/ctp", payload);
      }
      onSaved(res.data.id);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to save CTP inward entry");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="bg-white border border-sand rounded-2xl p-5">
        <h3 className="font-semibold text-charcoal mb-4">Inward Transaction Details</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className={labelClass}>Date</label>
            <input
              type="date"
              value={inwardDate}
              onChange={(e) => setInwardDate(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Time</label>
            <input
              type="time"
              value={inwardTime}
              onChange={(e) => setInwardTime(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Supplier Name</label>
            <SuggestionInput
              value={supplierName}
              onChange={setSupplierName}
              suggestions={suggestions?.supplier_names || []}
              onRemoveSuggestion={(value) => handleRemoveSuggestion("supplier_name", value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Invoice/Bill Number (optional)</label>
            <input
              type="text"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>
      </div>

      {/* Plate Sizes */}
      <div className="bg-white border border-sand rounded-2xl p-5 space-y-4">
        <h3 className="font-semibold text-charcoal">Plate Sizes</h3>

        {plateSizes.map((row, i) => (
          <div key={i} className="border border-sand rounded-lg p-4 bg-cream/30 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-rust">
                Size {i + 1}
              </span>
              {plateSizes.length > 1 && (
                <button
                  type="button"
                  onClick={() => removePlateSize(i)}
                  className="p-1.5 rounded-lg hover:bg-cream text-rust transition-colors"
                  title="Remove Plate Size"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>

            <div>
              <label className={labelClass}>Plate Size</label>
              <select
                value={row.plateSize}
                onChange={(e) => updatePlateSize(i, "plateSize", e.target.value)}
                className={inputClass}
              >
                <option value="" disabled>
                  Select plate size...
                </option>
                {PLATE_SIZE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            {row.plateSize === "Other" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Length (mm)</label>
                  <NumberInput
                    value={row.lengthMm}
                    onChange={(e) => updatePlateSize(i, "lengthMm", e.target.value)}
                    className={inputClass}
                    min={0}
                    step="0.01"
                  />
                </div>
                <div>
                  <label className={labelClass}>Width (mm)</label>
                  <NumberInput
                    value={row.widthMm}
                    onChange={(e) => updatePlateSize(i, "widthMm", e.target.value)}
                    className={inputClass}
                    min={0}
                    step="0.01"
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Total Packets</label>
                <NumberInput
                  value={row.totalPackets}
                  onChange={(e) => updatePlateSize(i, "totalPackets", e.target.value)}
                  className={inputClass}
                  min={0}
                  step="1"
                />
              </div>
              <div>
                <label className={labelClass}>Plates Per Packet</label>
                <NumberInput
                  value={row.platesPerPacket}
                  onChange={(e) => updatePlateSize(i, "platesPerPacket", e.target.value)}
                  className={inputClass}
                  min={0}
                  step="1"
                />
              </div>
            </div>

            <p className="text-xs text-taupe">
              Total Plates Received: <span className="font-semibold text-charcoal">{plateTotals[i]}</span>
            </p>
          </div>
        ))}

        <button
          type="button"
          onClick={addPlateSize}
          className="inline-flex items-center gap-2 border border-dashed border-taupe text-taupe rounded-lg px-4 py-2 text-sm font-medium hover:border-rust hover:text-rust transition-colors w-full justify-center"
        >
          <Plus size={16} />
          Add More Sizes?
        </button>
      </div>

      {/* Summary */}
      <div className="bg-cream/60 border border-sand rounded-lg p-4 space-y-1">
        <h3 className="font-semibold text-charcoal mb-2">Summary</h3>
        {plateSizes.map((row, i) => {
          const dims = dimensionsFor(row);
          return (
            <p key={i} className="text-sm text-charcoal">
              {dims.length} × {dims.width} mm = <span className="font-semibold">{plateTotals[i]}</span> plates
            </p>
          );
        })}
        <p className="text-sm text-charcoal mt-2 pt-2 border-t border-sand">
          Grand Total Plates Received: <span className="font-semibold">{grandTotal}</span>
        </p>
      </div>

      {/* Checked and Received By */}
      <div className="bg-white border border-sand rounded-2xl p-5">
        <label className={labelClass}>Checked and Received By</label>
        <select
          value={checkedReceivedBy}
          onChange={(e) => setCheckedReceivedBy(e.target.value)}
          className={inputClass}
        >
          <option value="" disabled>
            Select...
          </option>
          {CTP_CHECKED_RECEIVED_BY_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
        {checkedReceivedBy === "Other" && (
          <div className="mt-2">
            <SuggestionInput
              value={checkedReceivedByOther}
              onChange={setCheckedReceivedByOther}
              suggestions={suggestions?.checked_received_by || []}
              onRemoveSuggestion={(value) => handleRemoveSuggestion("checked_received_by", value)}
              className={inputClass}
              placeholder="Enter name"
            />
          </div>
        )}
      </div>

      {/* Remarks */}
      <div className="bg-white border border-sand rounded-2xl p-5">
        <label className={labelClass}>Remarks (optional)</label>
        <input
          type="text"
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          className={inputClass}
        />
      </div>

      {error && <p className="text-sm text-rust">{error}</p>}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving}
          className="bg-rust text-white rounded-lg px-5 py-2.5 text-sm font-medium hover:bg-rust/90 transition-colors disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save Inward Entry"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="bg-white border border-sand text-charcoal rounded-lg px-5 py-2.5 text-sm font-medium hover:border-rust transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
