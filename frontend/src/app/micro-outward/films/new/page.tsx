"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import AppHeader from "@/components/AppHeader";
import api from "@/lib/api";
import {
  MicroFilmStock,
  MICRO_ISSUED_BY_OPTIONS,
  MICRO_FILM_TYPES,
  MicroFilmType,
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

export default function MicroFilmsOutwardNewPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [stock, setStock] = useState<MicroFilmStock[]>([]);
  const [stockLoading, setStockLoading] = useState(true);

  const [outwardDate, setOutwardDate] = useState(getTodayDate());
  const [outwardTime, setOutwardTime] = useState(getCurrentTime());
  const [receiverName, setReceiverName] = useState("");
  const [issuedBy, setIssuedBy] = useState("");
  const [issuedByOther, setIssuedByOther] = useState("");
  const [jobName, setJobName] = useState("");
  const [filmLength, setFilmLength] = useState("");
  const [filmWidth, setFilmWidth] = useState("");
  const [filmType, setFilmType] = useState<MicroFilmType | "">("");
  const [quantity, setQuantity] = useState("");
  const [remarks, setRemarks] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    api
      .get<MicroFilmStock[]>("/api/micro-films-outward/stock")
      .then((res) => setStock(res.data))
      .catch(() => {})
      .finally(() => setStockLoading(false));
  }, [user]);

  const selectedStock = stock.find(
    (s) =>
      (s.film_length ?? null) === (filmLength ? Number(filmLength) : null) &&
      (s.film_width ?? null) === (filmWidth ? Number(filmWidth) : null) &&
      s.film_type === filmType
  );
  const availableForSelection = selectedStock?.available ?? null;

  const handleSubmit = async () => {
    setError("");
    if (!jobName.trim()) { setError("Job Name is required"); return; }
    const finalIssuedBy = issuedBy === "Other" ? issuedByOther.trim() : issuedBy;

    setSaving(true);
    try {
      const res = await api.post("/api/micro-films-outward", {
        outward_date: outwardDate,
        outward_time: outwardTime || null,
        receiver_name: receiverName.trim() || null,
        issued_by: finalIssuedBy || null,
        job_name: jobName.trim(),
        film_length: filmLength ? Number(filmLength) : null,
        film_width: filmWidth ? Number(filmWidth) : null,
        film_type: filmType || null,
        quantity: quantity ? Number(quantity) : null,
        remarks: remarks.trim() || null,
      });
      router.push(`/micro-outward/films/${res.data.id}`);
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
      <AppHeader title="New Films Outward" backHref="/micro-outward" />
      <main className="max-w-2xl mx-auto px-6 py-10 space-y-6">

        {/* Stock overview */}
        {!stockLoading && stock.length > 0 && (
          <div className="bg-white border border-sand rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-charcoal mb-3">Current Film Stock</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {stock.map((s, idx) => {
                const dims = (s.film_length || s.film_width)
                  ? `${s.film_length ?? "?"} × ${s.film_width ?? "?"} mm`
                  : "No size";
                return (
                  <div
                    key={idx}
                    className={`rounded-xl px-3 py-2.5 ${
                      s.available > 0 ? "bg-purple-50 border border-purple-100" : "bg-cream border border-sand opacity-60"
                    }`}
                  >
                    <p className="text-xs text-taupe">{dims}</p>
                    <p className="text-xs text-purple-600 font-medium">{s.film_type}</p>
                    <p className={`text-base font-bold mt-0.5 ${s.available > 0 ? "text-purple-700" : "text-taupe"}`}>
                      {s.available}
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
            <label className={labelClass}>Job Name <span className="text-rust">*</span></label>
            <input
              type="text"
              value={jobName}
              onChange={(e) => setJobName(e.target.value)}
              className={inputClass}
              placeholder="e.g. Job ABC"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Film Length (mm) <span className="text-taupe text-xs">(optional)</span></label>
              <input
                type="number"
                value={filmLength}
                onChange={(e) => setFilmLength(e.target.value)}
                onWheel={(e) => e.currentTarget.blur()}
                className={inputClass}
                placeholder="e.g. 300"
              />
            </div>
            <div>
              <label className={labelClass}>Film Width (mm) <span className="text-taupe text-xs">(optional)</span></label>
              <input
                type="number"
                value={filmWidth}
                onChange={(e) => setFilmWidth(e.target.value)}
                onWheel={(e) => e.currentTarget.blur()}
                className={inputClass}
                placeholder="e.g. 200"
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Film Type (optional)</label>
            <select
              value={filmType}
              onChange={(e) => setFilmType(e.target.value as MicroFilmType)}
              className={inputClass}
            >
              <option value="">— Select —</option>
              {MICRO_FILM_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {filmType && availableForSelection !== null && (
            <p className={`text-xs ${availableForSelection > 0 ? "text-green-600" : "text-amber-600"}`}>
              {availableForSelection > 0
                ? `Available: ${availableForSelection}`
                : "No stock available for this combination"}
            </p>
          )}

          <div>
            <label className={labelClass}>Quantity (optional)</label>
            <input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              onWheel={(e) => e.currentTarget.blur()}
              className={inputClass}
              placeholder="e.g. 10"
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
