"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import AppHeader from "@/components/AppHeader";
import api from "@/lib/api";
import {
  LAMINATION_FILM_TYPES,
  LaminationFilmType,
  LAMINATION_ISSUED_BY_OPTIONS,
  LaminationStockItem,
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

export default function LaminationOutwardNewPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [stock, setStock] = useState<LaminationStockItem[]>([]);
  const [stockLoading, setStockLoading] = useState(true);

  const [outwardDate, setOutwardDate] = useState(getTodayDate());
  const [outwardTime, setOutwardTime] = useState(getCurrentTime());
  const [receiverName, setReceiverName] = useState("");
  const [issuedBy, setIssuedBy] = useState("");
  const [issuedByOther, setIssuedByOther] = useState("");
  const [filmType, setFilmType] = useState<LaminationFilmType | "">("");
  const [customType, setCustomType] = useState("");
  const [filmLength, setFilmLength] = useState("");
  const [filmWidth, setFilmWidth] = useState("");
  const [quantityIssued, setQuantityIssued] = useState("");
  const [remarks, setRemarks] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showShortageModal, setShowShortageModal] = useState(false);
  const [availableStock, setAvailableStock] = useState<number | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    api
      .get<LaminationStockItem[]>("/api/lamination-outward/stock")
      .then((res) => setStock(res.data))
      .catch(() => {})
      .finally(() => setStockLoading(false));
  }, [user]);

  // Filter stock to matching film type and optional size
  const filteredStock = stock.filter((s) => {
    if (!filmType || s.film_type !== filmType) return false;
    if (filmType === "OTHER" && customType && s.custom_type !== customType) return false;
    if (filmLength && s.film_length !== Number(filmLength)) return false;
    if (filmWidth && s.film_width !== Number(filmWidth)) return false;
    return true;
  });

  const totalAvailable = filteredStock.reduce((sum, s) => sum + s.total_weight, 0);

  const buildPayload = (forceAdjustment: boolean) => {
    const finalIssuedBy = issuedBy === "Other" ? issuedByOther.trim() : issuedBy;
    return {
      outward_date: outwardDate,
      outward_time: outwardTime || null,
      receiver_name: receiverName.trim() || null,
      issued_by: finalIssuedBy || null,
      film_type: filmType,
      custom_type: filmType === "OTHER" ? customType.trim() || null : null,
      film_length: filmLength ? Number(filmLength) : null,
      film_width: filmWidth ? Number(filmWidth) : null,
      quantity_issued: Number(quantityIssued),
      remarks: remarks.trim() || null,
      force_adjustment: forceAdjustment,
    };
  };

  const submitOutward = async (forceAdjustment: boolean) => {
    setError("");
    setSaving(true);
    try {
      const res = await api.post("/api/lamination-outward", buildPayload(forceAdjustment));
      if (res.data?.status === "stock_shortage") {
        setAvailableStock(res.data.available ?? null);
        setShowShortageModal(true);
        setSaving(false);
        return;
      }
      router.push(`/lamination-outward/${res.data.id}`);
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { detail?: string } } }).response?.data?.detail ||
          "Failed to save entry"
      );
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    setError("");
    if (!filmType) { setError("Film Type is required"); return; }
    if (filmType === "OTHER" && !customType.trim()) { setError("Custom Type is required when Film Type is OTHER"); return; }
    if (!quantityIssued || Number(quantityIssued) <= 0) { setError("Quantity to issue must be a positive number"); return; }
    await submitOutward(false);
  };

  const handleConfirmIssue = async () => {
    setShowShortageModal(false);
    await submitOutward(true);
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
      <AppHeader title="New Lamination Film Outward" backHref="/lamination-outward" />
      <main className="max-w-2xl mx-auto px-6 py-10 space-y-6">

        {/* Stock overview */}
        {!stockLoading && stock.length > 0 && (
          <div className="bg-white border border-sand rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-charcoal mb-3">Current Film Stock</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {stock.map((s, idx) => {
                const label = s.film_type === "OTHER" && s.custom_type ? s.custom_type : s.film_type;
                const dims = (s.film_length || s.film_width)
                  ? `${s.film_length ?? "?"}×${s.film_width ?? "?"} mm`
                  : "No size";
                return (
                  <div
                    key={idx}
                    className={`rounded-xl px-3 py-2.5 ${
                      s.total_weight > 0 ? "bg-rust/10 border border-rust/20" : "bg-cream border border-sand opacity-60"
                    }`}
                  >
                    <p className="text-xs font-semibold text-charcoal">{label}</p>
                    <p className="text-xs text-taupe">{dims}</p>
                    <p className={`text-base font-bold mt-0.5 ${s.total_weight > 0 ? "text-rust" : "text-taupe"}`}>
                      {s.roll_count} rolls · {s.total_weight.toFixed(2)} kg
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Form */}
        <div className="bg-white border border-sand rounded-2xl p-5 space-y-4">
          <h3 className="font-semibold text-charcoal">Outward Details</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Date</label>
              <input
                type="date"
                value={outwardDate}
                onChange={(e) => setOutwardDate(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Time (optional)</label>
              <input
                type="time"
                value={outwardTime}
                onChange={(e) => setOutwardTime(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Receiver Name (optional)</label>
              <input
                type="text"
                value={receiverName}
                onChange={(e) => setReceiverName(e.target.value)}
                className={inputClass}
                placeholder="e.g. Ravi Kumar"
              />
            </div>
            <div>
              <label className={labelClass}>Issued By</label>
              <select
                value={issuedBy}
                onChange={(e) => setIssuedBy(e.target.value)}
                className={inputClass}
              >
                <option value="" disabled>Select…</option>
                {LAMINATION_ISSUED_BY_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
              {issuedBy === "Other" && (
                <input
                  type="text"
                  value={issuedByOther}
                  onChange={(e) => setIssuedByOther(e.target.value)}
                  className={`${inputClass} mt-2`}
                  placeholder="Enter name"
                />
              )}
            </div>
          </div>

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
                placeholder="e.g. Matte, Gloss"
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

          {/* Available stock for selection */}
          {filmType && filteredStock.length > 0 && (
            <div className="rounded-xl bg-green-50 border border-green-100 px-4 py-3">
              <p className="text-xs text-green-600 font-medium mb-1">Available for selected film</p>
              {filteredStock.map((s, idx) => (
                <p key={idx} className="text-sm text-green-800 font-semibold">
                  {s.roll_count} rolls · {s.total_weight.toFixed(3)} kg available
                </p>
              ))}
              {filteredStock.length > 1 && (
                <p className="text-xs text-green-600 mt-1">Total: {totalAvailable.toFixed(3)} kg</p>
              )}
            </div>
          )}

          {filmType && filteredStock.length === 0 && !stockLoading && (
            <p className="text-xs text-amber-600 bg-amber-50 rounded-xl px-4 py-2.5">
              No stock found for this selection. You can still issue — a deficit adjustment will be recorded.
            </p>
          )}

          <div>
            <label className={labelClass}>Quantity to Issue (kg) <span className="text-rust">*</span></label>
            <input
              type="number"
              min={0.001}
              step={0.001}
              value={quantityIssued}
              onChange={(e) => setQuantityIssued(e.target.value)}
              onWheel={(e) => e.currentTarget.blur()}
              className={inputClass}
              placeholder="e.g. 15.500"
            />
          </div>

          <div>
            <label className={labelClass}>Remarks (optional)</label>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className={`${inputClass} resize-none`}
              rows={2}
            />
          </div>
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
            onClick={() => router.push("/lamination-outward")}
            className="bg-white border border-sand text-charcoal rounded-xl px-5 py-2.5 text-sm font-medium hover:border-rust transition-colors"
          >
            Cancel
          </button>
        </div>
      </main>

      {/* Stock Shortage Modal */}
      {showShortageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 space-y-4">
            <h3 className="text-base font-bold text-charcoal">Insufficient Stock</h3>
            <p className="text-sm text-taupe">
              Insufficient stock.{" "}
              {availableStock !== null ? (
                <>Available: <span className="font-semibold text-charcoal">{availableStock.toFixed(3)} kg</span>.{" "}</>
              ) : null}
              Issue anyway? A deficit adjustment will be recorded.
            </p>
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setShowShortageModal(false)}
                className="flex-1 bg-white border border-sand text-charcoal rounded-xl py-2.5 text-sm font-medium hover:border-rust transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmIssue}
                disabled={saving}
                className="flex-1 bg-rust text-white rounded-xl py-2.5 text-sm font-medium hover:bg-rust/90 disabled:opacity-60 transition-colors"
              >
                {saving ? "Issuing..." : "Confirm Issue"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
