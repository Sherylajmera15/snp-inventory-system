"use client";

import { useEffect, useId, useState } from "react";
import api from "@/lib/api";
import {
  DIES_CHECKED_RECEIVED_BY_OPTIONS,
  DiesInwardDetail,
  DiesSuggestionCategory,
  DiesSuggestions,
} from "@/types/dies";
import DieItemFields, {
  DieItemRow,
  emptyDieItem,
  dieItemRowFromItem,
  validateDieItemRow,
} from "./DieItemFields";
import SuggestionInput from "./SuggestionInput";
import { Plus } from "lucide-react";

const SUGGESTION_FIELD: Record<DiesSuggestionCategory, keyof DiesSuggestions> = {
  supplier_name: "supplier_names",
  job_name: "job_names",
  storage_location: "storage_locations",
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

interface DieEntryFormProps {
  initialData?: DiesInwardDetail;
  onSaved: (id: number) => void;
  onCancel?: () => void;
}

export default function DieEntryForm({ initialData, onSaved, onCancel }: DieEntryFormProps) {
  const idPrefix = useId();

  const [inwardDate, setInwardDate] = useState(initialData?.inward_date || getTodayDate());
  const [inwardTime, setInwardTime] = useState(
    initialData?.inward_time ? initialData.inward_time.slice(0, 5) : getCurrentTime()
  );
  const [supplierName, setSupplierName] = useState(initialData?.supplier_name || "");
  const [invoiceNumber, setInvoiceNumber] = useState(initialData?.invoice_number || "");

  const initialCheckedByIsKnown =
    !!initialData?.checked_received_by &&
    (DIES_CHECKED_RECEIVED_BY_OPTIONS as readonly string[]).includes(
      initialData.checked_received_by
    );
  const [checkedReceivedBy, setCheckedReceivedBy] = useState(
    initialData ? (initialCheckedByIsKnown ? initialData.checked_received_by || "" : "Other") : ""
  );
  const [checkedReceivedByOther, setCheckedReceivedByOther] = useState(
    initialData && !initialCheckedByIsKnown ? initialData.checked_received_by || "" : ""
  );

  const [remarks, setRemarks] = useState(initialData?.remarks || "");
  const [items, setItems] = useState<DieItemRow[]>(
    initialData?.items?.length ? initialData.items.map(dieItemRowFromItem) : [emptyDieItem()]
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [suggestions, setSuggestions] = useState<DiesSuggestions | undefined>(undefined);

  const [pendingPayload, setPendingPayload] = useState<Record<string, unknown> | null>(null);
  const [pendingReplaces, setPendingReplaces] = useState<string[] | null>(null);

  useEffect(() => {
    api
      .get<DiesSuggestions>("/api/dies/suggestions")
      .then((res) => setSuggestions(res.data))
      .catch(() => {});
  }, []);

  const handleRemoveSuggestion = (category: DiesSuggestionCategory, value: string) => {
    api.delete(`/api/dies/suggestions/${category}/${encodeURIComponent(value)}`).catch(() => {});
    setSuggestions((prev) => {
      if (!prev) return prev;
      const key = SUGGESTION_FIELD[category];
      return { ...prev, [key]: (prev[key] as string[]).filter((v) => v !== value) };
    });
  };

  const updateItem = (index: number, updated: DieItemRow) => {
    setItems((prev) => prev.map((r, i) => (i === index ? updated : r)));
  };
  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };
  const addItem = () => setItems((prev) => [...prev, emptyDieItem()]);

  const buildPayload = (): Record<string, unknown> | null => {
    if (!inwardDate) { setError("Date is required"); return null; }
    if (!inwardTime) { setError("Time is required"); return null; }
    if (!supplierName.trim()) { setError("Supplier Name is required"); return null; }

    const effectiveChecked =
      checkedReceivedBy === "Other" ? checkedReceivedByOther.trim() : checkedReceivedBy;
    if (!effectiveChecked) {
      setError("Checked and Received By is required");
      return null;
    }

    const itemPayloads: Record<string, unknown>[] = [];
    for (let i = 0; i < items.length; i++) {
      const result = validateDieItemRow(items[i], i);
      if ("error" in result) { setError(result.error); return null; }
      itemPayloads.push(result.payload);
    }

    return {
      inward_date: inwardDate,
      inward_time: inwardTime,
      supplier_name: supplierName.trim(),
      invoice_number: invoiceNumber.trim() || null,
      checked_received_by: effectiveChecked,
      remarks: remarks.trim() || null,
      items: itemPayloads,
    };
  };

  const doSave = async (payload: Record<string, unknown>, replaceExisting: boolean) => {
    setSaving(true);
    setError("");
    try {
      const body = { ...payload, replace_existing: replaceExisting };
      const res = initialData
        ? await api.put(`/api/dies/${initialData.id}`, body)
        : await api.post("/api/dies", body);
      onSaved(res.data.id);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      const detail = axiosErr.response?.data?.detail;
      setError(typeof detail === "string" ? detail : "Failed to save entry");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    setError("");
    const payload = buildPayload();
    if (!payload) return;

    // Pre-check for duplicate active die numbers BEFORE attempting save
    const dieNumbers = (payload.items as Array<{ die_number: string }>).map((i) => i.die_number);
    try {
      const checkRes = await api.post("/api/dies/check-duplicates", {
        die_numbers: dieNumbers,
        exclude_inward_id: initialData?.id ?? null,
      });
      const duplicates: string[] = checkRes.data.duplicates ?? [];
      if (duplicates.length > 0) {
        setPendingPayload(payload);
        setPendingReplaces(duplicates);
        return;
      }
    } catch {
      // If the check itself fails, proceed to save and let the server respond
    }

    await doSave(payload, false);
  };

  const handleConfirmReplace = async () => {
    if (!pendingPayload) return;
    setPendingReplaces(null);
    await doSave(pendingPayload, true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-sand rounded-2xl p-5 space-y-4">
        <h3 className="font-semibold text-charcoal">Entry Details</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor={`${idPrefix}-date`} className={labelClass}>
              Date *
            </label>
            <input
              id={`${idPrefix}-date`}
              type="date"
              className={inputClass}
              value={inwardDate}
              onChange={(e) => setInwardDate(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor={`${idPrefix}-time`} className={labelClass}>
              Time *
            </label>
            <input
              id={`${idPrefix}-time`}
              type="time"
              className={inputClass}
              value={inwardTime}
              onChange={(e) => setInwardTime(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Supplier Name *</label>
            <SuggestionInput
              value={supplierName}
              onChange={setSupplierName}
              suggestions={suggestions?.supplier_names ?? []}
              onRemoveSuggestion={(v) => handleRemoveSuggestion("supplier_name", v)}
              placeholder="Supplier name"
            />
          </div>
          <div>
            <label htmlFor={`${idPrefix}-invoice`} className={labelClass}>
              Invoice / Bill Number (optional)
            </label>
            <input
              id={`${idPrefix}-invoice`}
              className={inputClass}
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              placeholder="Invoice number"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Checked and Received By *</label>
            <select
              className={inputClass}
              value={checkedReceivedBy}
              onChange={(e) => setCheckedReceivedBy(e.target.value)}
            >
              <option value="">Select</option>
              {DIES_CHECKED_RECEIVED_BY_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </div>
          {checkedReceivedBy === "Other" && (
            <div>
              <label className={labelClass}>Specify Name *</label>
              <SuggestionInput
                value={checkedReceivedByOther}
                onChange={setCheckedReceivedByOther}
                suggestions={suggestions?.checked_received_by ?? []}
                onRemoveSuggestion={(v) => handleRemoveSuggestion("checked_received_by", v)}
                placeholder="Enter name"
              />
            </div>
          )}
        </div>

        <div>
          <label htmlFor={`${idPrefix}-remarks`} className={labelClass}>
            Remarks (optional)
          </label>
          <textarea
            id={`${idPrefix}-remarks`}
            className={`${inputClass} resize-none`}
            rows={2}
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="Any additional notes"
          />
        </div>
      </div>

      {/* Die Items */}
      <div className="space-y-3">
        <h3 className="font-semibold text-charcoal">Dies ({items.length})</h3>
        {items.map((row, i) => (
          <DieItemFields
            key={i}
            index={i}
            row={row}
            suggestions={suggestions}
            onChange={(updated) => updateItem(i, updated)}
            onRemove={() => removeItem(i)}
            canRemove={items.length > 1}
            onRemoveSuggestion={handleRemoveSuggestion}
          />
        ))}

        <button
          type="button"
          onClick={addItem}
          className="inline-flex items-center gap-2 text-sm text-rust font-medium hover:text-rust/70 transition-colors"
        >
          <Plus size={16} />
          Add Another Die
        </button>
      </div>

      {/* Error */}
      {error && (
        <p className="text-sm text-rust bg-rust/5 border border-rust/20 rounded-lg px-4 py-2">
          {error}
        </p>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="bg-rust text-white rounded-lg px-6 py-2.5 text-sm font-medium hover:bg-rust/90 disabled:opacity-50 transition-colors"
        >
          {saving ? "Saving…" : "Save Entry"}
        </button>
        {onCancel && (
          <button
            onClick={onCancel}
            className="bg-white border border-sand text-charcoal rounded-lg px-6 py-2.5 text-sm font-medium hover:border-rust transition-colors"
          >
            Cancel
          </button>
        )}
      </div>

      {/* Duplicate Replace Modal */}
      {pendingReplaces && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-6">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full space-y-4">
            <h3 className="font-semibold text-charcoal text-base">Die Number Already Exists</h3>
            <p className="text-sm text-taupe">
              The following Die Numbers already exist as <strong>Active</strong>:
            </p>
            <ul className="space-y-1">
              {pendingReplaces.map((dn) => (
                <li
                  key={dn}
                  className="text-sm font-medium text-charcoal bg-cream px-3 py-1.5 rounded-lg"
                >
                  {dn}
                </li>
              ))}
            </ul>
            <p className="text-sm text-taupe">
              Saving will mark these existing dies as <strong>Discontinued</strong> and create new
              Active records. Do you want to replace them?
            </p>
            <div className="flex gap-3 pt-1">
              <button
                onClick={handleConfirmReplace}
                disabled={saving}
                className="bg-rust text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-rust/90 disabled:opacity-50 transition-colors"
              >
                {saving ? "Saving…" : "Yes, Replace"}
              </button>
              <button
                onClick={() => setPendingReplaces(null)}
                className="bg-white border border-sand text-charcoal rounded-lg px-4 py-2 text-sm font-medium hover:border-rust transition-colors"
              >
                No, Keep Editing
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
