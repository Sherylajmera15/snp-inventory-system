"use client";

import { useEffect, useId, useState } from "react";
import api from "@/lib/api";
import { INK_CHECKED_RECEIVED_BY_OPTIONS, InkInwardDetail, InkSuggestionCategory, InkSuggestions } from "@/types/ink";
import InkItemFields, { InkItemRow, emptyInkItem, groupWeightFor, inkItemRowFromItem, validateInkItemRow } from "./InkItemForm";
import SuggestionInput from "./SuggestionInput";
import { Plus } from "lucide-react";

const SUGGESTION_FIELD: Record<InkSuggestionCategory, keyof InkSuggestions> = {
  supplier_name: "supplier_names",
  pantone_number: "pantone_numbers",
  varnish_type: "varnish_types",
  checked_received_by: "checked_received_by",
};

const inputClass =
  "w-full rounded-lg border border-sand bg-cream/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust";
const labelClass = "block text-sm font-medium text-charcoal mb-1";

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

interface InkEntryFormProps {
  initialData?: InkInwardDetail;
  onSaved: (id: number) => void;
  onCancel?: () => void;
}

export default function InkEntryForm({ initialData, onSaved, onCancel }: InkEntryFormProps) {
  const idPrefix = useId();

  const [inwardDate, setInwardDate] = useState(initialData?.inward_date || getTodayDate());
  const [inwardTime, setInwardTime] = useState(
    initialData?.inward_time ? initialData.inward_time.slice(0, 5) : getCurrentTime()
  );
  const [supplierName, setSupplierName] = useState(initialData?.supplier_name || "");
  const [invoiceNumber, setInvoiceNumber] = useState(initialData?.invoice_number || "");

  const initialCheckedByIsKnown =
    !!initialData?.checked_received_by &&
    (INK_CHECKED_RECEIVED_BY_OPTIONS as readonly string[]).includes(initialData.checked_received_by);
  const [checkedReceivedBy, setCheckedReceivedBy] = useState(
    initialData
      ? initialCheckedByIsKnown
        ? initialData.checked_received_by || ""
        : "Other"
      : ""
  );
  const [checkedReceivedByOther, setCheckedReceivedByOther] = useState(
    initialData && !initialCheckedByIsKnown ? initialData.checked_received_by || "" : ""
  );

  const [remarks, setRemarks] = useState(initialData?.remarks || "");
  const [items, setItems] = useState<InkItemRow[]>(
    initialData?.items?.length ? initialData.items.map(inkItemRowFromItem) : [emptyInkItem()]
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [suggestions, setSuggestions] = useState<InkSuggestions | undefined>(undefined);

  useEffect(() => {
    api
      .get<InkSuggestions>("/api/ink/suggestions")
      .then((res) => setSuggestions(res.data))
      .catch(() => {});
  }, []);

  const handleRemoveSuggestion = (category: InkSuggestionCategory, value: string) => {
    setSuggestions((prev) => {
      if (!prev) return prev;
      const field = SUGGESTION_FIELD[category];
      return { ...prev, [field]: prev[field].filter((v) => v !== value) };
    });
    api.delete(`/api/ink/suggestions/${category}/${encodeURIComponent(value)}`).catch(() => {});
  };

  const updateItem = (index: number, row: InkItemRow) => {
    const next = [...items];
    next[index] = row;
    setItems(next);
  };

  const addItem = () => setItems([...items, emptyInkItem()]);

  const removeItem = (index: number) => setItems(items.filter((_, i) => i !== index));

  const grandTotalWeight = items.reduce(
    (sum, row) => sum + row.boxGroups.reduce((s, g) => s + groupWeightFor(g), 0),
    0
  );

  const handleSubmit = async () => {
    setError("");
    if (!supplierName.trim()) {
      setError("Supplier Name is required");
      return;
    }
    const finalCheckedBy =
      checkedReceivedBy === "Other" ? checkedReceivedByOther.trim() : checkedReceivedBy;
    if (!finalCheckedBy) {
      setError("Checked and Received By is required");
      return;
    }
    if (items.length === 0) {
      setError("Add at least one Ink/Varnish Item before saving");
      return;
    }

    const resolvedItems = [];
    for (const row of items) {
      const result = validateInkItemRow(row);
      if (result.error) {
        setError(result.error);
        return;
      }
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

      let res;
      if (initialData) {
        res = await api.put(`/api/ink/${initialData.id}`, payload);
      } else {
        res = await api.post("/api/ink", payload);
      }
      onSaved(res.data.id);
    } catch (err: unknown) {
      setError((err as { response?: { data?: { detail?: string } } }).response?.data?.detail || "Failed to save inward entry");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="bg-white border border-sand rounded-2xl p-5 space-y-4">
        <h3 className="font-semibold text-charcoal">Inward Transaction Details</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

        {/* Checked and Received By */}
        <div>
          <label className={labelClass}>Checked and Received By</label>
          <select
            value={checkedReceivedBy}
            onChange={(e) => setCheckedReceivedBy(e.target.value)}
            className={inputClass}
          >
            <option value="" disabled>
              Select...
            </option>
            {INK_CHECKED_RECEIVED_BY_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
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
          <input
            type="text"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      {/* Items section */}
      <div className="space-y-3">
        <h3 className="font-semibold text-charcoal">Ink / Varnish Items</h3>

        {items.map((row, i) => (
          <InkItemFields
            key={i}
            row={row}
            index={i}
            suggestions={suggestions}
            onRemoveSuggestion={handleRemoveSuggestion}
            onChange={(next) => updateItem(i, next)}
            onRemove={items.length > 1 ? () => removeItem(i) : undefined}
          />
        ))}

        <button
          type="button"
          onClick={addItem}
          className="inline-flex items-center gap-2 border border-dashed border-taupe text-taupe rounded-lg px-4 py-2.5 text-sm font-medium hover:border-rust hover:text-rust transition-colors w-full justify-center"
        >
          <Plus size={16} />
          {items.length === 0 ? "Add Item" : "Add Another Item"}
        </button>
      </div>

      {items.length > 0 && (
        <div className="bg-cream/60 border border-sand rounded-lg p-4">
          <p className="text-sm text-charcoal">
            Grand Total Weight: <span className="font-semibold">{grandTotalWeight.toFixed(2)} kg</span>
          </p>
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
