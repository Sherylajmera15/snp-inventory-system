"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import AppHeader from "@/components/AppHeader";
import api from "@/lib/api";
import { CTPStockItem, CTPOutwardItemInput, CTPStockShortage } from "@/types/ctp-outward";
import { Plus, Trash2, AlertTriangle } from "lucide-react";
import { IssuedByInput, ReceivedByInput } from "@/components/AutocompleteInput";

// ─── Stock card ───────────────────────────────────────────────────────────────

function StockCard({
  stock,
  selected,
  disabled,
  onClick,
}: {
  stock: CTPStockItem;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const base =
    "rounded-xl border p-3 text-left transition-all cursor-pointer flex flex-col gap-0.5 text-sm";
  const stateClass = disabled
    ? "border-sand bg-cream/40 opacity-60 cursor-default"
    : selected
    ? "border-rust bg-rust/5 ring-1 ring-rust"
    : "border-sand bg-white hover:border-rust/40 hover:bg-cream/40";

  return (
    <button type="button" className={`${base} ${stateClass}`} onClick={disabled ? undefined : onClick}>
      <span className="font-semibold text-charcoal">{stock.plate_size}</span>
      <span className="text-xs text-taupe">
        {stock.available_qty > 0 ? `${stock.available_qty.toLocaleString()} plates available` : "Out of stock"}
      </span>
    </button>
  );
}

// ─── Add item form ────────────────────────────────────────────────────────────

function AddItemForm({
  stockList,
  usedSizes,
  onAdd,
}: {
  stockList: CTPStockItem[];
  usedSizes: Set<string>;
  onAdd: (item: CTPOutwardItemInput) => void;
}) {
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [qty, setQty] = useState<number | "">("");
  const [error, setError] = useState("");

  const selectedStock = stockList.find((s) => s.plate_size === selectedSize) ?? null;

  const handleAdd = () => {
    if (!selectedSize) { setError("Select a plate size"); return; }
    if (!qty || Number(qty) <= 0) { setError("Enter a valid quantity"); return; }
    onAdd({ plate_size: selectedSize, quantity_issued: Number(qty) });
    setSelectedSize(null);
    setQty("");
    setError("");
  };

  return (
    <div className="space-y-3">
      {stockList.length === 0 ? (
        <p className="text-sm text-taupe italic">No CTP plate stock found. Please add inward stock first.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-72 overflow-y-auto pr-1">
          {stockList.map((s) => (
            <StockCard
              key={s.plate_size}
              stock={s}
              selected={selectedSize === s.plate_size}
              disabled={usedSizes.has(s.plate_size)}
              onClick={() => { setSelectedSize(s.plate_size); setError(""); }}
            />
          ))}
        </div>
      )}

      {selectedStock && (
        <div className="flex items-center gap-3 pt-1">
          <label className="text-sm text-charcoal whitespace-nowrap">
            Quantity for <strong>{selectedStock.plate_size}</strong>:
          </label>
          <input
            type="number" min={1} value={qty}
            onChange={(e) => { setQty(e.target.value === "" ? "" : Number(e.target.value)); setError(""); }}
            placeholder="e.g. 10"
            className="w-28 rounded-lg border border-sand bg-cream/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust"
          />
          <button type="button" onClick={handleAdd}
            className="inline-flex items-center gap-1.5 bg-rust text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-rust/90 transition-colors">
            <Plus size={14} />Add
          </button>
        </div>
      )}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

// ─── Shortage modal ───────────────────────────────────────────────────────────

function ShortageModal({
  shortages,
  onProceed,
  onCancel,
}: {
  shortages: CTPStockShortage[];
  onProceed: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
        <div className="flex items-center gap-3">
          <AlertTriangle className="text-amber-500 shrink-0" size={22} />
          <h2 className="text-base font-bold text-charcoal">Insufficient Stock</h2>
        </div>
        <p className="text-sm text-taupe">
          The following plate sizes have insufficient stock. Proceeding will create adjustment entries automatically.
        </p>
        <div className="space-y-2">
          {shortages.map((s, i) => (
            <div key={i} className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-2.5 text-sm">
              <p className="font-semibold text-charcoal">{s.plate_size}</p>
              <div className="flex gap-4 mt-0.5 text-xs text-taupe">
                <span>Available: <strong>{s.available}</strong></span>
                <span>Requested: <strong>{s.requested}</strong></span>
                <span>Shortage: <strong className="text-red-500">{s.shortage}</strong></span>
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-3 pt-1">
          <button onClick={onCancel}
            className="flex-1 border border-sand text-charcoal rounded-xl py-2.5 text-sm font-medium hover:bg-cream transition-colors">
            No, go back
          </button>
          <button onClick={onProceed}
            className="flex-1 bg-amber-500 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-amber-600 transition-colors">
            Yes, create adjustment
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CTPOutwardNewPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const today = new Date().toISOString().slice(0, 10);
  const nowTime = new Date().toTimeString().slice(0, 5);

  const [stockList, setStockList] = useState<CTPStockItem[]>([]);
  const [items, setItems] = useState<CTPOutwardItemInput[]>([]);

  const [outwardDate, setOutwardDate] = useState(today);
  const [outwardTime, setOutwardTime] = useState(nowTime);
  const [issuedBy, setIssuedBy] = useState("");
  const [receivedBy, setReceivedBy] = useState("");
  const [remarks, setRemarks] = useState("");

  const [shortages, setShortages] = useState<CTPStockShortage[]>([]);
  const [showShortageModal, setShowShortageModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    if (!loading && !user) { router.replace("/login"); return; }
    if (!user) return;
    api.get("/api/ctp-outward/stock").then((r) => setStockList(r.data));
  }, [user, loading, router]);

  const usedSizes = new Set(items.map((i) => i.plate_size));

  const addItem = (item: CTPOutwardItemInput) => setItems((prev) => [...prev, item]);
  const removeItem = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx));

  const doSubmit = async (force: boolean) => {
    setSubmitting(true);
    setSubmitError("");
    try {
      const payload = {
        outward_date: outwardDate,
        outward_time: outwardTime || null,
        issued_by: issuedBy.trim() || null,
        received_by: receivedBy.trim() || null,
        remarks: remarks.trim() || null,
        items,
        force_adjustment: force,
      };
      const res = await api.post("/api/ctp-outward", payload);
      if (res.data.status === "stock_shortage") {
        setShortages(res.data.shortages);
        setShowShortageModal(true);
      } else {
        router.push("/ctp-outward");
      }
    } catch (e: any) {
      setSubmitError(e.response?.data?.detail ?? "An error occurred. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) { setSubmitError("Add at least one plate item."); return; }
    doSubmit(false);
  };

  const handleProceedWithShortage = () => {
    setShowShortageModal(false);
    doSubmit(true);
  };

  if (loading || !user) {
    return <div className="min-h-screen flex items-center justify-center bg-cream"><p className="text-taupe">Loading...</p></div>;
  }

  return (
    <div className="min-h-screen bg-cream">
      <AppHeader title="New CTP Plates Outward" backHref="/ctp-outward" />

      <main className="max-w-3xl mx-auto px-6 py-10">
        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Header info */}
          <div className="bg-white border border-sand rounded-2xl p-6 space-y-5">
            <h2 className="text-sm font-semibold text-charcoal">Header Information</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs text-taupe font-medium">Date <span className="text-red-400">*</span></label>
                <input type="date" required value={outwardDate} onChange={(e) => setOutwardDate(e.target.value)}
                  className="w-full rounded-lg border border-sand bg-cream/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-taupe font-medium">Time</label>
                <input type="time" value={outwardTime} onChange={(e) => setOutwardTime(e.target.value)}
                  className="w-full rounded-lg border border-sand bg-cream/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-taupe font-medium">Issued By</label>
                <IssuedByInput value={issuedBy} onChange={setIssuedBy} />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-taupe font-medium">Received By</label>
                <ReceivedByInput value={receivedBy} onChange={setReceivedBy} />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs text-taupe font-medium">Remarks <span className="text-taupe font-normal">(optional)</span></label>
                <textarea rows={2} placeholder="Any additional notes…" value={remarks} onChange={(e) => setRemarks(e.target.value)}
                  className="w-full rounded-lg border border-sand bg-cream/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust resize-none" />
              </div>
            </div>
          </div>

          {/* Plate selection */}
          <div className="bg-white border border-sand rounded-2xl p-6 space-y-4">
            <h2 className="text-sm font-semibold text-charcoal">Select Plates</h2>
            <AddItemForm stockList={stockList} usedSizes={usedSizes} onAdd={addItem} />
          </div>

          {/* Added items list */}
          {items.length > 0 && (
            <div className="bg-white border border-sand rounded-2xl p-6 space-y-3">
              <h2 className="text-sm font-semibold text-charcoal">Plates to Issue ({items.length})</h2>
              <div className="divide-y divide-sand">
                {items.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between py-2.5">
                    <div>
                      <p className="text-sm font-semibold text-charcoal">{item.plate_size}</p>
                      <p className="text-xs text-taupe">{item.quantity_issued.toLocaleString()} plates</p>
                    </div>
                    <button type="button" onClick={() => removeItem(idx)}
                      className="text-taupe hover:text-red-500 transition-colors p-1.5 rounded-lg hover:bg-red-50">
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="pt-1 border-t border-sand">
                <p className="text-xs text-taupe text-right">
                  Total: <strong className="text-charcoal">{items.reduce((s, i) => s + i.quantity_issued, 0).toLocaleString()} plates</strong>
                </p>
              </div>
            </div>
          )}

          {submitError && (
            <p className="text-sm text-red-500 text-center">{submitError}</p>
          )}

          <div className="flex gap-3">
            <button type="button" onClick={() => router.back()}
              className="flex-1 border border-sand text-charcoal rounded-xl py-3 text-sm font-medium hover:bg-white transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={submitting}
              className="flex-1 bg-rust text-white rounded-xl py-3 text-sm font-semibold hover:bg-rust/90 disabled:opacity-60 transition-colors">
              {submitting ? "Saving…" : "Save Outward Entry"}
            </button>
          </div>
        </form>
      </main>

      {showShortageModal && (
        <ShortageModal
          shortages={shortages}
          onProceed={handleProceedWithShortage}
          onCancel={() => setShowShortageModal(false)}
        />
      )}
    </div>
  );
}
