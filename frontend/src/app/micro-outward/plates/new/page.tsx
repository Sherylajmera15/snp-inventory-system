"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import AppHeader from "@/components/AppHeader";
import api from "@/lib/api";
import {
  MicroPlateStock,
  MICRO_ISSUED_BY_OPTIONS,
  MICRO_PLATE_SIZES,
} from "@/types/micro";

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

export default function MicroPlatesOutwardNewPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [stock, setStock] = useState<MicroPlateStock[]>([]);
  const [stockLoading, setStockLoading] = useState(true);

  const [outwardDate, setOutwardDate] = useState(getTodayDate());
  const [outwardTime, setOutwardTime] = useState(getCurrentTime());
  const [receiverName, setReceiverName] = useState("");
  const [issuedBy, setIssuedBy] = useState("");
  const [issuedByOther, setIssuedByOther] = useState("");
  const [plateSize, setPlateSize] = useState("");
  const [numberOfPlates, setNumberOfPlates] = useState("");
  const [remarks, setRemarks] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    api
      .get<MicroPlateStock[]>("/api/micro-plates-outward/stock")
      .then((res) => setStock(res.data))
      .catch(() => {})
      .finally(() => setStockLoading(false));
  }, [user]);

  const selectedStock = stock.find((s) => s.plate_size === plateSize);
  const availableForSize = selectedStock?.available ?? 0;

  const handleSubmit = async () => {
    setError("");
    if (!plateSize) { setError("Plate size is required"); return; }
    if (!numberOfPlates || Number(numberOfPlates) <= 0) { setError("Number of plates must be a positive number"); return; }
    if (Number(numberOfPlates) > availableForSize) {
      setError(`Cannot exceed available stock (${availableForSize} plates available for ${plateSize})`);
      return;
    }
    const finalIssuedBy = issuedBy === "Other" ? issuedByOther.trim() : issuedBy;

    setSaving(true);
    try {
      const res = await api.post("/api/micro-plates-outward", {
        outward_date: outwardDate,
        outward_time: outwardTime || null,
        receiver_name: receiverName.trim() || null,
        issued_by: finalIssuedBy || null,
        plate_size: plateSize,
        number_of_plates: Number(numberOfPlates),
        remarks: remarks.trim() || null,
      });
      router.push(`/micro-outward/plates/${res.data.id}`);
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
      <AppHeader title="New Plates Outward" backHref="/micro-outward" />
      <main className="max-w-2xl mx-auto px-6 py-10 space-y-6">

        {/* Stock overview */}
        {!stockLoading && stock.length > 0 && (
          <div className="bg-white border border-sand rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-charcoal mb-3">Current Plate Stock</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {stock.map((s) => (
                <div
                  key={s.plate_size}
                  className={`rounded-xl px-3 py-2.5 ${
                    s.available > 0 ? "bg-blue-50 border border-blue-100" : "bg-cream border border-sand opacity-60"
                  }`}
                >
                  <p className="text-xs text-taupe truncate">{s.plate_size}</p>
                  <p className={`text-base font-bold ${s.available > 0 ? "text-blue-700" : "text-taupe"}`}>
                    {s.available}
                  </p>
                </div>
              ))}
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
                {MICRO_ISSUED_BY_OPTIONS.map((opt) => (
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
            <label className={labelClass}>Plate Size</label>
            <select
              value={plateSize}
              onChange={(e) => setPlateSize(e.target.value)}
              className={inputClass}
            >
              <option value="" disabled>Select plate size…</option>
              {MICRO_PLATE_SIZES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
              {/* Also show sizes from stock not in the preset */}
              {stock
                .filter((s) => !MICRO_PLATE_SIZES.includes(s.plate_size as typeof MICRO_PLATE_SIZES[number]))
                .map((s) => (
                  <option key={s.plate_size} value={s.plate_size}>{s.plate_size}</option>
                ))}
            </select>
            {plateSize && (
              <p className={`mt-1 text-xs ${availableForSize > 0 ? "text-green-600" : "text-amber-600"}`}>
                {stockLoading
                  ? "Loading stock…"
                  : availableForSize > 0
                  ? `Available: ${availableForSize} plates`
                  : "No stock available for this size"}
              </p>
            )}
          </div>

          <div>
            <label className={labelClass}>Number of Plates</label>
            <input
              type="number"
              min={1}
              value={numberOfPlates}
              onChange={(e) => setNumberOfPlates(e.target.value)}
              onWheel={(e) => e.currentTarget.blur()}
              className={inputClass}
              placeholder="e.g. 5"
            />
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
          <button
            type="button"
            onClick={() => router.push("/micro-outward")}
            className="bg-white border border-sand text-charcoal rounded-lg px-5 py-2.5 text-sm font-medium hover:border-rust transition-colors"
          >
            Cancel
          </button>
        </div>
      </main>
    </div>
  );
}
