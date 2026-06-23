"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import AppHeader from "@/components/AppHeader";
import api from "@/lib/api";
import { X } from "lucide-react";
import {
  LAMINATION_FILM_TYPES,
  LaminationFilmType,
  LAMINATION_RECEIVED_BY_OPTIONS,
} from "@/types/lamination";

const inputClass =
  "w-full rounded-xl border border-sand bg-cream/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust";
const labelClass = "block text-xs font-medium text-taupe mb-1";

function getTodayDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function getCurrentTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function LaminationNewPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [inwardDate, setInwardDate] = useState(getTodayDate());
  const [inwardTime, setInwardTime] = useState(getCurrentTime());
  const [supplierName, setSupplierName] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [receivedBy, setReceivedBy] = useState("");
  const [receivedByOther, setReceivedByOther] = useState("");
  const [remarks, setRemarks] = useState("");
  const [filmType, setFilmType] = useState<LaminationFilmType | "">("");
  const [customType, setCustomType] = useState("");
  const [filmLength, setFilmLength] = useState("");
  const [filmWidth, setFilmWidth] = useState("");
  const [rollCount, setRollCount] = useState("1");
  const [rollWeights, setRollWeights] = useState<string[]>([""]);

  const [supplierNames, setSupplierNames] = useState<string[]>([]);
  const [showSupplierDrop, setShowSupplierDrop] = useState(false);
  const supplierRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  useEffect(() => {
    api.get("/api/lamination/suggestions")
      .then((res) => setSupplierNames(res.data.supplier_names ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (supplierRef.current && !supplierRef.current.contains(e.target as Node)) {
        setShowSupplierDrop(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const deleteSupplierSuggestion = async (value: string) => {
    setSupplierNames((prev) => prev.filter((n) => n !== value));
    try { await api.delete("/api/lamination/suggestions", { params: { value } }); } catch { /* ignore */ }
  };

  useEffect(() => {
    const count = Math.max(1, parseInt(rollCount) || 0);
    setRollWeights((prev) => {
      const next = [...prev];
      while (next.length < count) next.push("");
      return next.slice(0, count);
    });
  }, [rollCount]);

  const handleSubmit = async () => {
    setError("");
    if (!supplierName.trim()) { setError("Supplier Name is required"); return; }
    const finalReceivedBy = receivedBy === "Other" ? receivedByOther.trim() : receivedBy;
    if (!finalReceivedBy) { setError("Received By is required"); return; }
    if (!filmType) { setError("Film Type is required"); return; }
    if (filmType === "OTHER" && !customType.trim()) { setError("Custom Type is required when Film Type is OTHER"); return; }
    const rollCountNum = parseInt(rollCount) || 0;
    if (rollCountNum < 1) { setError("Number of Rolls must be at least 1"); return; }
    for (let i = 0; i < rollWeights.length; i++) {
      const w = Number(rollWeights[i]);
      if (!rollWeights[i] || isNaN(w) || w <= 0) {
        setError(`Roll ${i + 1} weight must be a positive number`);
        return;
      }
    }

    setSaving(true);
    try {
      const payload = {
        inward_date: inwardDate,
        inward_time: inwardTime || null,
        supplier_name: supplierName.trim(),
        invoice_number: invoiceNumber.trim() || null,
        received_by: finalReceivedBy,
        remarks: remarks.trim() || null,
        film_type: filmType,
        custom_type: filmType === "OTHER" ? customType.trim() : null,
        film_length: filmLength ? Number(filmLength) : null,
        film_width: filmWidth ? Number(filmWidth) : null,
        rolls: rollWeights.map((w, i) => ({ roll_number: i + 1, weight: Number(w) })),
      };
      const res = await api.post("/api/lamination", payload);
      router.push(`/lamination/${res.data.id}`);
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { detail?: string } } }).response?.data?.detail ||
          "Failed to save entry"
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream">
        <p className="text-taupe">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream">
      <AppHeader title="New Lamination Film Entry" backHref="/lamination" />
      <main className="max-w-3xl mx-auto px-6 py-10 space-y-6">

        {/* Transaction Details */}
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
            <div ref={supplierRef} className="relative">
              <label className={labelClass}>Supplier Name <span className="text-rust">*</span></label>
              <input
                type="text"
                value={supplierName}
                onChange={(e) => { setSupplierName(e.target.value); setShowSupplierDrop(true); }}
                onFocus={() => setShowSupplierDrop(true)}
                className={inputClass}
                placeholder="e.g. ABC Films Ltd."
                autoComplete="off"
              />
              {showSupplierDrop && (() => {
                const filtered = supplierNames.filter((n) =>
                  n.toLowerCase().includes(supplierName.toLowerCase())
                );
                return filtered.length > 0 ? (
                  <ul className="absolute z-20 left-0 right-0 mt-1 bg-white border border-sand rounded-xl shadow-lg max-h-48 overflow-y-auto">
                    {filtered.map((name) => (
                      <li key={name} className="flex items-center justify-between gap-2 px-3 py-2 hover:bg-cream/60 text-sm">
                        <span
                          className="flex-1 cursor-pointer text-charcoal truncate"
                          onMouseDown={(e) => { e.preventDefault(); setSupplierName(name); setShowSupplierDrop(false); }}
                        >
                          {name}
                        </span>
                        <button
                          type="button"
                          onMouseDown={(e) => { e.preventDefault(); deleteSupplierSuggestion(name); }}
                          className="shrink-0 text-taupe hover:text-rust transition-colors"
                          title="Remove from memory"
                        >
                          <X size={13} />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null;
              })()}
            </div>
            <div>
              <label className={labelClass}>Invoice / Bill Number (optional)</label>
              <input
                type="text"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                className={inputClass}
                placeholder="e.g. INV-2024-001"
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Received By <span className="text-rust">*</span></label>
            <select
              value={receivedBy}
              onChange={(e) => setReceivedBy(e.target.value)}
              className={inputClass}
            >
              <option value="" disabled>Select…</option>
              {LAMINATION_RECEIVED_BY_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
            {receivedBy === "Other" && (
              <div className="mt-2">
                <input
                  type="text"
                  value={receivedByOther}
                  onChange={(e) => setReceivedByOther(e.target.value)}
                  className={inputClass}
                  placeholder="Enter name"
                />
              </div>
            )}
          </div>

          <div>
            <label className={labelClass}>Remarks (optional)</label>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className={`${inputClass} resize-none`}
              rows={2}
              placeholder="Any additional notes…"
            />
          </div>
        </div>

        {/* Film Details */}
        <div className="bg-white border border-sand rounded-2xl p-5 space-y-4">
          <h3 className="font-semibold text-charcoal">Film Details</h3>

          <div>
            <label className={labelClass}>Film Type <span className="text-rust">*</span></label>
            <select
              value={filmType}
              onChange={(e) => setFilmType(e.target.value as LaminationFilmType)}
              className={inputClass}
            >
              <option value="" disabled>Select film type…</option>
              {LAMINATION_FILM_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {filmType === "OTHER" && (
            <div>
              <label className={labelClass}>Custom Type <span className="text-rust">*</span></label>
              <input
                type="text"
                value={customType}
                onChange={(e) => setCustomType(e.target.value)}
                className={inputClass}
                placeholder="e.g. Matte, Gloss, etc."
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Film Length (mm) <span className="text-taupe">(optional)</span></label>
              <input
                type="number"
                value={filmLength}
                onChange={(e) => setFilmLength(e.target.value)}
                onWheel={(e) => e.currentTarget.blur()}
                className={inputClass}
                placeholder="e.g. 3000"
              />
            </div>
            <div>
              <label className={labelClass}>Film Width (mm) <span className="text-taupe">(optional)</span></label>
              <input
                type="number"
                value={filmWidth}
                onChange={(e) => setFilmWidth(e.target.value)}
                onWheel={(e) => e.currentTarget.blur()}
                className={inputClass}
                placeholder="e.g. 1000"
              />
            </div>
          </div>
        </div>

        {/* Roll Weights */}
        <div className="bg-white border border-sand rounded-2xl p-5 space-y-4">
          <h3 className="font-semibold text-charcoal">Roll Weights</h3>

          <div>
            <label className={labelClass}>Number of Rolls <span className="text-rust">*</span></label>
            <input
              type="number"
              min={1}
              value={rollCount}
              onChange={(e) => setRollCount(e.target.value)}
              onWheel={(e) => e.currentTarget.blur()}
              className={inputClass}
              placeholder="e.g. 5"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {rollWeights.map((w, i) => (
              <div key={i}>
                <label className={labelClass}>
                  Roll {i + 1} Weight (kg) <span className="text-rust">*</span>
                </label>
                <input
                  type="number"
                  min={0.001}
                  step={0.001}
                  value={w}
                  onChange={(e) => {
                    const next = [...rollWeights];
                    next[i] = e.target.value;
                    setRollWeights(next);
                  }}
                  onWheel={(e) => e.currentTarget.blur()}
                  className={inputClass}
                  placeholder="e.g. 25.500"
                />
              </div>
            ))}
          </div>

          {rollWeights.length > 0 && rollWeights.some((w) => w && !isNaN(Number(w))) && (
            <div className="bg-cream rounded-xl px-4 py-2.5">
              <p className="text-xs text-taupe">Total Weight</p>
              <p className="text-sm font-bold text-charcoal">
                {rollWeights.reduce((sum, w) => sum + (Number(w) || 0), 0).toFixed(3)} kg
              </p>
            </div>
          )}
        </div>

        {error && <p className="text-sm text-rust bg-red-50 rounded-lg px-4 py-2">{error}</p>}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="bg-rust text-white rounded-xl px-5 py-2.5 text-sm font-medium hover:bg-rust/90 transition-colors disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save Entry"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/lamination")}
            className="bg-white border border-sand text-charcoal rounded-xl px-5 py-2.5 text-sm font-medium hover:border-rust transition-colors"
          >
            Cancel
          </button>
        </div>
      </main>
    </div>
  );
}
