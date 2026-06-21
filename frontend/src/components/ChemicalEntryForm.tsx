"use client";

import { useEffect, useId, useState } from "react";
import api from "@/lib/api";
import {
  CHEM_CHECKED_RECEIVED_BY_OPTIONS,
  ChemicalInwardDetail,
  ChemicalSuggestionCategory,
  ChemicalSuggestions,
} from "@/types/chemical";
import ChemicalItemFields, {
  ChemicalItemRow,
  emptyChemicalItem,
  chemicalItemRowFromItem,
  validateChemicalItemRow,
} from "./ChemicalItemFields";
import { effectiveUnit, groupQuantityFor } from "./QuantityGroupSection";
import SuggestionInput from "./SuggestionInput";
import { Plus } from "lucide-react";

const SUGGESTION_FIELD: Record<ChemicalSuggestionCategory, keyof ChemicalSuggestions> = {
  supplier_name: "supplier_names",
  manufacturer: "manufacturers",
  custom_name: "custom_names",
  checked_received_by: "checked_received_by",
};

const inputClass =
  "w-full rounded-lg border border-sand bg-cream/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust";
const labelClass = "block text-sm font-medium text-charcoal mb-1";

function getTodayDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function getCurrentTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

interface ChemicalEntryFormProps {
  initialData?: ChemicalInwardDetail;
  onSaved: (id: number) => void;
  onCancel?: () => void;
}

export default function ChemicalEntryForm({ initialData, onSaved, onCancel }: ChemicalEntryFormProps) {
  const idPrefix = useId();

  const [inwardDate, setInwardDate] = useState(initialData?.inward_date || getTodayDate());
  const [inwardTime, setInwardTime] = useState(
    initialData?.inward_time ? initialData.inward_time.slice(0, 5) : getCurrentTime()
  );
  const [supplierName, setSupplierName] = useState(initialData?.supplier_name || "");
  const [invoiceNumber, setInvoiceNumber] = useState(initialData?.invoice_number || "");

  const initialCheckedByIsKnown =
    !!initialData?.checked_received_by &&
    (CHEM_CHECKED_RECEIVED_BY_OPTIONS as readonly string[]).includes(initialData.checked_received_by);
  const [checkedReceivedBy, setCheckedReceivedBy] = useState(
    initialData ? (initialCheckedByIsKnown ? initialData.checked_received_by || "" : "Other") : ""
  );
  const [checkedReceivedByOther, setCheckedReceivedByOther] = useState(
    initialData && !initialCheckedByIsKnown ? initialData.checked_received_by || "" : ""
  );

  const [remarks, setRemarks] = useState(initialData?.remarks || "");
  const [items, setItems] = useState<ChemicalItemRow[]>(
    initialData?.items?.length ? initialData.items.map(chemicalItemRowFromItem) : [emptyChemicalItem()]
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [suggestions, setSuggestions] = useState<ChemicalSuggestions | undefined>(undefined);

  useEffect(() => {
    api.get<ChemicalSuggestions>("/api/chemicals/suggestions").then((res) => setSuggestions(res.data)).catch(() => {});
  }, []);

  const handleRemoveSuggestion = (category: ChemicalSuggestionCategory, value: string) => {
    setSuggestions((prev) => {
      if (!prev) return prev;
      const field = SUGGESTION_FIELD[category];
      return { ...prev, [field]: prev[field].filter((v) => v !== value) };
    });
    api.delete(`/api/chemicals/suggestions/${category}/${encodeURIComponent(value)}`).catch(() => {});
  };

  const updateItem = (index: number, row: ChemicalItemRow) => {
    const next = [...items];
    next[index] = row;
    setItems(next);
  };

  // per-unit grand totals across all items
  const grandTotals: Record<string, number> = {};
  for (const row of items) {
    for (const g of row.quantityGroups) {
      const u = effectiveUnit(g);
      if (!u) continue;
      grandTotals[u] = (grandTotals[u] || 0) + groupQuantityFor(g);
    }
  }

  const handleSubmit = async () => {
    setError("");
    if (!supplierName.trim()) { setError("Supplier Name is required"); return; }
    const finalCheckedBy = checkedReceivedBy === "Other" ? checkedReceivedByOther.trim() : checkedReceivedBy;
    if (!finalCheckedBy) { setError("Checked and Received By is required"); return; }
    if (items.length === 0) { setError("Add at least one Chemical Item before saving"); return; }

    const resolvedItems = [];
    for (const row of items) {
      const result = validateChemicalItemRow(row);
      if (result.error) { setError(result.error); return; }
      resolvedItems.push(result.item);
    }

    setSaving(true);
    try {
      const payload = {
        inward_date: inwardDate,
        inward_time: inwardTime,
        supplier_name: supplierName.trim(),
        invoice_number: invoiceNumber.trim() || null,
        checked_received_by: finalCheckedBy,
        remarks: remarks.trim() || null,
        items: resolvedItems,
      };
      const res = initialData
        ? await api.put(`/api/chemicals/${initialData.id}`, payload)
        : await api.post("/api/chemicals", payload);
      onSaved(res.data.id);
    } catch (err: unknown) {
      setError((err as { response?: { data?: { detail?: string } } }).response?.data?.detail || "Failed to save inward entry");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-sand rounded-2xl p-5 space-y-4">
        <h3 className="font-semibold text-charcoal">Inward Transaction Details</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Date</label>
            <input type="date" value={inwardDate} onChange={(e) => setInwardDate(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Time</label>
            <input type="time" value={inwardTime} onChange={(e) => setInwardTime(e.target.value)} className={inputClass} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Supplier Name</label>
            <SuggestionInput
              value={supplierName}
              onChange={setSupplierName}
              suggestions={suggestions?.supplier_names || []}
              onRemoveSuggestion={(v) => handleRemoveSuggestion("supplier_name", v)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Invoice/Bill Number (optional)</label>
            <input type="text" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} className={inputClass} />
          </div>
        </div>

        <div>
          <label className={labelClass}>Checked and Received By</label>
          <select value={checkedReceivedBy} onChange={(e) => setCheckedReceivedBy(e.target.value)} className={inputClass}>
            <option value="" disabled>Select...</option>
            {CHEM_CHECKED_RECEIVED_BY_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
          {checkedReceivedBy === "Other" && (
            <div className="mt-2">
              <input
                type="text"
                value={checkedReceivedByOther}
                onChange={(e) => setCheckedReceivedByOther(e.target.value)}
                className={inputClass}
                placeholder="Enter name"
                list={`${idPrefix}-checked-by-suggestions`}
              />
              <datalist id={`${idPrefix}-checked-by-suggestions`}>
                {(suggestions?.checked_received_by || []).map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </div>
          )}
        </div>

        <div>
          <label className={labelClass}>Remarks (optional)</label>
          <input type="text" value={remarks} onChange={(e) => setRemarks(e.target.value)} className={inputClass} />
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="font-semibold text-charcoal">Chemical Items</h3>
        {items.map((row, i) => (
          <ChemicalItemFields
            key={i}
            row={row}
            index={i}
            suggestions={suggestions}
            onRemoveSuggestion={handleRemoveSuggestion}
            onChange={(next) => updateItem(i, next)}
            onRemove={items.length > 1 ? () => setItems(items.filter((_, idx) => idx !== i)) : undefined}
          />
        ))}
        <button
          type="button"
          onClick={() => setItems([...items, emptyChemicalItem()])}
          className="inline-flex items-center gap-2 border border-dashed border-taupe text-taupe rounded-lg px-4 py-2.5 text-sm font-medium hover:border-rust hover:text-rust transition-colors w-full justify-center"
        >
          <Plus size={16} />
          {items.length === 0 ? "Add Item" : "Add Another Item"}
        </button>
      </div>

      {Object.entries(grandTotals).length > 0 && (
        <div className="bg-cream/60 border border-sand rounded-lg p-4 space-y-1">
          <p className="text-sm font-semibold text-charcoal">Grand Total Quantity</p>
          {Object.entries(grandTotals).map(([unit, qty]) => (
            <p key={unit} className="text-sm text-charcoal">
              {unit}: <span className="font-semibold">{qty.toFixed(3).replace(/\.?0+$/, "")}</span>
            </p>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-rust">{error}</p>}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving}
          className="bg-rust text-white rounded-lg px-5 py-2.5 text-sm font-medium hover:bg-rust/90 transition-colors disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save Entry"}
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
