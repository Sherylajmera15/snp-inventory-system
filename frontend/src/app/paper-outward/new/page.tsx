"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import AppHeader from "@/components/AppHeader";
import api from "@/lib/api";
import { StockItem, OutwardItemInput, StockShortage } from "@/types/paper-outward";
import { Plus, Trash2, AlertTriangle, CheckCircle } from "lucide-react";
import { IssuedByInput, ReceivedByInput } from "@/components/AutocompleteInput";
import FIFOPreview, { FIFOBatch, reelsToFIFOBatches } from "@/components/FIFOPreview";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function stockKey(s: StockItem) {
  return `${s.quality}||${s.gsm}||${s.form_type}||${s.reel_width ?? ""}||${s.sheet_length ?? ""}||${s.sheet_width ?? ""}`;
}

function sizeLabel(s: StockItem): string {
  if (s.form_type === "Reel Form") {
    return s.reel_width ? `${s.reel_width} cm Reel Width` : "—";
  }
  if (s.sheet_length && s.sheet_width) {
    return `${s.sheet_length} × ${s.sheet_width} cm`;
  }
  return "—";
}

function shortageSize(s: StockShortage): string {
  if (s.form_type === "Reel Form") {
    return s.reel_width ? `${s.reel_width} cm Reel Width` : "";
  }
  if (s.sheet_length && s.sheet_width) {
    return `${s.sheet_length} × ${s.sheet_width} cm`;
  }
  return "";
}

// ─── Job Card Autocomplete ────────────────────────────────────────────────────

function JobCardInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      api.get("/api/paper-outward/job-card-suggestions", { params: { q: value } })
        .then((r) => setSuggestions(r.data))
        .catch(() => setSuggestions([]));
    }, 200);
    return () => clearTimeout(t);
  }, [value]);

  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="e.g. JC-001 (Optional)"
        className="w-full rounded-xl border border-sand bg-cream/40 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust"
      />
      {open && suggestions.length > 0 && (
        <ul className="absolute z-20 left-0 right-0 mt-1 bg-white border border-sand rounded-xl shadow-lg overflow-hidden max-h-40 overflow-y-auto">
          {suggestions.map((s) => (
            <li key={s}>
              <button
                type="button"
                className="w-full text-left px-4 py-2.5 text-sm text-charcoal hover:bg-cream transition-colors"
                onMouseDown={() => { onChange(s); setOpen(false); }}
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Stock Shortage Popup ─────────────────────────────────────────────────────

function ShortageModal({
  shortages,
  onYes,
  onNo,
}: {
  shortages: StockShortage[];
  onYes: () => void;
  onNo: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-amber-50 rounded-xl p-2">
            <AlertTriangle size={20} className="text-amber-600" />
          </div>
          <div>
            <h2 className="text-base font-bold text-charcoal">Insufficient Stock</h2>
            <p className="text-xs text-taupe">Some items exceed available stock.</p>
          </div>
        </div>

        <div className="space-y-3 mb-5">
          {shortages.map((s, i) => {
            const size = shortageSize(s);
            return (
              <div key={i} className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                <p className="text-sm font-semibold text-charcoal">
                  {s.quality} — {s.gsm} GSM
                  {size && <span className="font-normal text-taupe"> · {size}</span>}
                  <span className="font-normal text-taupe"> ({s.form_type.replace(" Form", "")})</span>
                </p>
                <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <p className="text-taupe">Available</p>
                    <p className="font-bold text-charcoal">{s.available.toLocaleString()} {s.unit}</p>
                  </div>
                  <div>
                    <p className="text-taupe">Requested</p>
                    <p className="font-bold text-charcoal">{s.requested.toLocaleString()} {s.unit}</p>
                  </div>
                  <div>
                    <p className="text-taupe">Shortage</p>
                    <p className="font-bold text-red-600">{s.shortage.toLocaleString()} {s.unit}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-sm text-charcoal mb-4 font-medium">
          Are you bringing the additional stock from another source?
        </p>
        <p className="text-xs text-taupe mb-5">
          If YES, an adjustment entry will be automatically created for the shortage amount.
        </p>

        <div className="flex gap-3">
          <button onClick={onNo}
            className="flex-1 border border-sand bg-white text-charcoal rounded-xl py-2.5 text-sm font-medium hover:bg-cream transition-colors">
            No — Go Back
          </button>
          <button onClick={onYes}
            className="flex-1 bg-rust text-white rounded-xl py-2.5 text-sm font-medium hover:bg-rust/90 transition-colors">
            Yes — Create Adjustment
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Stock Card ───────────────────────────────────────────────────────────────

function StockCard({ s, selected, onClick }: { s: StockItem; selected: boolean; onClick: () => void }) {
  const size = sizeLabel(s);
  const type = s.form_type === "Reel Form" ? "Reel" : "Sheet";
  const inStock = s.available_qty > 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left rounded-xl border-2 p-3 transition-all w-full ${
        selected
          ? "border-rust bg-rust/5 shadow-sm"
          : inStock
            ? "border-sand bg-white hover:border-rust/50 hover:shadow-sm"
            : "border-sand bg-gray-50 opacity-60 cursor-default"
      }`}
    >
      <p className="text-sm font-bold text-charcoal leading-tight">{s.quality}</p>
      <p className="text-xs text-taupe mt-0.5">{s.gsm} GSM</p>
      <p className="text-xs text-taupe">{size}</p>
      <p className="text-xs text-taupe">{type}</p>
      <div className={`mt-2 pt-2 border-t border-sand/60 text-xs font-semibold ${inStock ? "text-green-700" : "text-red-600"}`}>
        {inStock
          ? <>Available: {s.available_qty.toLocaleString()} {s.unit}</>
          : "Out of stock"}
      </div>
    </button>
  );
}

// ─── Item selector form ───────────────────────────────────────────────────────

function AddItemForm({
  stockList,
  onAdd,
  onCancel,
}: {
  stockList: StockItem[];
  onAdd: (item: OutwardItemInput) => void;
  onCancel: () => void;
}) {
  const [selectedKey, setSelectedKey] = useState("");
  const [issueMethod, setIssueMethod] = useState<"sheets" | "weight">("sheets");
  const [quantity, setQuantity] = useState("");
  const [reelBatches, setReelBatches] = useState<FIFOBatch[]>([]);
  const [reelLoading, setReelLoading] = useState(false);

  const selected = stockList.find((s) => stockKey(s) === selectedKey) ?? null;

  function handleAdd() {
    if (!selected || !quantity || Number(quantity) <= 0) return;

    const item: OutwardItemInput = {
      quality: selected.quality,
      gsm: selected.gsm,
      form_type: selected.form_type,
      reel_width: selected.reel_width,
      sheet_length: selected.sheet_length,
      sheet_width: selected.sheet_width,
    };

    if (selected.form_type === "Reel Form") {
      item.weight_issued = parseFloat(quantity);
    } else {
      item.issue_method = issueMethod;
      if (issueMethod === "sheets") {
        item.sheets_issued = parseInt(quantity, 10);
      } else {
        item.weight_issued = parseFloat(quantity);
      }
    }

    onAdd(item);
    setSelectedKey("");
    setQuantity("");
  }

  return (
    <div className="bg-white border-2 border-rust/20 rounded-2xl p-5 space-y-4">
      <h3 className="text-sm font-bold text-charcoal">Add Paper Item</h3>

      {/* Stock cards grid */}
      <div>
        <label className="block text-xs font-medium text-taupe mb-2">Select Paper from Stock</label>
        {stockList.length === 0 ? (
          <p className="text-sm text-taupe py-4 text-center">No stock available. Create inward entries first.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-72 overflow-y-auto pr-0.5">
            {stockList.map((s) => {
              const key = stockKey(s);
              return (
                <StockCard
                  key={key}
                  s={s}
                  selected={selectedKey === key}
                  onClick={() => {
                    if (s.available_qty <= 0) return;
                    setSelectedKey(key);
                    setQuantity("");
                    setIssueMethod("sheets");
                    setReelBatches([]);
                    if (s.form_type === "Reel Form") {
                      setReelLoading(true);
                      api.get("/api/paper-outward/stock-reels", {
                        params: { quality: s.quality, gsm: s.gsm, ...(s.reel_width ? { reel_width: s.reel_width } : {}) }
                      }).then((r) => setReelBatches(reelsToFIFOBatches(r.data.reels ?? [])))
                        .catch(() => setReelBatches([]))
                        .finally(() => setReelLoading(false));
                    }
                  }}
                />
              );
            })}
          </div>
        )}
      </div>

      {selected && (
        <>
          {/* Sheet method toggle */}
          {selected.form_type === "Sheet Form" && (
            <div>
              <label className="block text-xs font-medium text-taupe mb-1.5">Issue Method</label>
              <div className="flex gap-2">
                {(["sheets", "weight"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => { setIssueMethod(m); setQuantity(""); }}
                    className={`flex-1 rounded-xl border py-2 text-sm font-medium transition-colors ${
                      issueMethod === m
                        ? "bg-rust text-white border-rust"
                        : "bg-white text-charcoal border-sand hover:bg-cream"
                    }`}
                  >
                    {m === "sheets" ? "By Number of Sheets" : "By Weight (Kg)"}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quantity input */}
          <div>
            <label className="block text-xs font-medium text-taupe mb-1.5">
              {selected.form_type === "Reel Form"
                ? "Weight to Issue (Kg)"
                : issueMethod === "sheets"
                  ? "Number of Sheets to Issue"
                  : "Weight to Issue (Kg)"}
            </label>
            <input
              type="number"
              min="0.01"
              step={selected.form_type === "Reel Form" || issueMethod === "weight" ? "0.01" : "1"}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              onWheel={(e) => e.currentTarget.blur()}
              placeholder={
                selected.form_type === "Reel Form" || issueMethod === "weight"
                  ? "e.g. 1250.00"
                  : "e.g. 25000"
              }
              className="w-full rounded-xl border border-sand bg-cream/40 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust"
            />
          </div>

          {/* FIFO reel preview for Reel Form */}
          {selected.form_type === "Reel Form" && (
            reelLoading
              ? <p className="text-xs text-taupe text-center py-2">Loading reel breakdown…</p>
              : reelBatches.length > 0 && (
                  <FIFOPreview
                    batches={reelBatches}
                    unit="Kg"
                    netConsumedSoFar={Math.max(0, reelBatches.reduce((s, b) => s + b.totalQty, 0) - selected.available_qty)}
                    newQty={quantity === "" ? "" : parseFloat(quantity) || ""}
                    containerLabel="Reel"
                  />
                )
          )}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onCancel}
              className="flex-1 border border-sand bg-white text-charcoal rounded-xl py-2.5 text-sm font-medium hover:bg-cream transition-colors">
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAdd}
              disabled={!quantity || Number(quantity) <= 0}
              className="flex-1 bg-rust text-white rounded-xl py-2.5 text-sm font-medium hover:bg-rust/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Add to List
            </button>
          </div>
        </>
      )}

      {!selected && stockList.length > 0 && (
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onCancel}
            className="w-full border border-sand bg-white text-charcoal rounded-xl py-2.5 text-sm font-medium hover:bg-cream transition-colors">
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PaperOutwardNewPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [stockList, setStockList] = useState<StockItem[]>([]);
  const [stockLoading, setStockLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addedItems, setAddedItems] = useState<OutwardItemInput[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [shortages, setShortages] = useState<StockShortage[]>([]);
  const [pendingForceAdjust, setPendingForceAdjust] = useState(false);

  const today = new Date().toISOString().slice(0, 10);
  const nowTime = new Date().toTimeString().slice(0, 5);

  const [outwardDate, setOutwardDate] = useState(today);
  const [outwardTime, setOutwardTime] = useState(nowTime);
  const [jobName, setJobName] = useState("");
  const [jobCardNumber, setJobCardNumber] = useState("");
  const [issuedBy, setIssuedBy] = useState("");
  const [receivedBy, setReceivedBy] = useState("");
  const [remarks, setRemarks] = useState("");

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    api.get("/api/paper-outward/stock")
      .then((r) => setStockList(r.data))
      .finally(() => setStockLoading(false));
  }, [user]);

  function handleAddItem(item: OutwardItemInput) {
    setAddedItems((prev) => [...prev, item]);
    setShowAddForm(false);
  }

  function handleRemoveItem(idx: number) {
    setAddedItems((prev) => prev.filter((_, i) => i !== idx));
  }

  async function submitOutward(forceAdjustment: boolean) {
    setSubmitting(true);
    try {
      const res = await api.post("/api/paper-outward", {
        outward_date: outwardDate,
        outward_time: outwardTime || null,
        job_name: jobName.trim(),
        job_card_number: jobCardNumber.trim() || null,
        issued_by: issuedBy.trim() || null,
        received_by: receivedBy.trim() || null,
        remarks: remarks.trim() || null,
        items: addedItems,
        force_adjustment: forceAdjustment,
      });

      if (res.data.status === "stock_shortage") {
        setShortages(res.data.shortages);
        setPendingForceAdjust(true);
        return;
      }

      router.push("/paper-outward");
    } finally {
      setSubmitting(false);
    }
  }

  function handleSave() {
    if (!jobName.trim()) { alert("Job Name is required."); return; }
    if (addedItems.length === 0) { alert("Add at least one paper item."); return; }
    submitOutward(false);
  }

  function itemLabel(item: OutwardItemInput) {
    let sizeStr = "";
    if (item.form_type === "Reel Form" && item.reel_width) {
      sizeStr = ` · ${item.reel_width} cm`;
    } else if (item.form_type === "Sheet Form" && item.sheet_length && item.sheet_width) {
      sizeStr = ` · ${item.sheet_length}×${item.sheet_width} cm`;
    }
    const base = `${item.quality} — ${item.gsm} GSM${sizeStr} (${item.form_type.replace(" Form", "")})`;
    if (item.form_type === "Reel Form") return `${base}: ${item.weight_issued} Kg`;
    if (item.issue_method === "sheets") return `${base}: ${item.sheets_issued?.toLocaleString()} Sheets`;
    return `${base}: ${item.weight_issued} Kg (weight)`;
  }

  if (loading || !user) {
    return <div className="min-h-screen flex items-center justify-center bg-cream"><p className="text-taupe">Loading...</p></div>;
  }

  return (
    <div className="min-h-screen bg-cream">
      <AppHeader title="New Paper Outward Entry" backHref="/paper-outward" />

      <main className="max-w-3xl mx-auto px-6 py-10 space-y-6">

        {/* Header section */}
        <div className="bg-white border border-sand rounded-2xl p-6 space-y-4">
          <h2 className="text-sm font-bold text-charcoal uppercase tracking-widest">Entry Details</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-taupe mb-1.5">Date</label>
              <input type="date" value={outwardDate} onChange={(e) => setOutwardDate(e.target.value)}
                className="w-full rounded-xl border border-sand bg-cream/40 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust" />
            </div>
            <div>
              <label className="block text-xs font-medium text-taupe mb-1.5">Time</label>
              <input type="time" value={outwardTime} onChange={(e) => setOutwardTime(e.target.value)}
                className="w-full rounded-xl border border-sand bg-cream/40 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-taupe mb-1.5">
              Job Name <span className="text-red-500">*</span>
            </label>
            <input type="text" value={jobName} onChange={(e) => setJobName(e.target.value)}
              placeholder="e.g. Syncom Carton"
              className="w-full rounded-xl border border-sand bg-cream/40 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust" />
          </div>
          <div>
            <label className="block text-xs font-medium text-taupe mb-1.5">Job Card Number (Optional)</label>
            <JobCardInput value={jobCardNumber} onChange={setJobCardNumber} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-taupe mb-1.5">Issued By</label>
              <IssuedByInput value={issuedBy} onChange={setIssuedBy} />
            </div>
            <div>
              <label className="block text-xs font-medium text-taupe mb-1.5">Received By</label>
              <ReceivedByInput value={receivedBy} onChange={setReceivedBy} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-taupe mb-1.5">Remarks (Optional)</label>
            <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)}
              rows={2} placeholder="Any additional notes…"
              className="w-full rounded-xl border border-sand bg-cream/40 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust resize-none" />
          </div>
        </div>

        {/* Paper items section */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-charcoal uppercase tracking-widest">Paper to Issue</h2>

          {/* Added items list */}
          {addedItems.length > 0 && (
            <div className="space-y-2">
              {addedItems.map((item, i) => (
                <div key={i} className="bg-white border border-sand rounded-xl px-4 py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <CheckCircle size={16} className="text-green-500 shrink-0" />
                    <p className="text-sm text-charcoal truncate">{itemLabel(item)}</p>
                  </div>
                  <button onClick={() => handleRemoveItem(i)}
                    className="shrink-0 text-taupe hover:text-red-500 transition-colors">
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add item form */}
          {showAddForm && !stockLoading ? (
            <AddItemForm
              stockList={stockList}
              onAdd={handleAddItem}
              onCancel={() => setShowAddForm(false)}
            />
          ) : (
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              disabled={stockLoading}
              className="w-full border-2 border-dashed border-sand rounded-2xl py-4 text-sm font-medium text-taupe hover:border-rust hover:text-rust transition-colors flex items-center justify-center gap-2"
            >
              <Plus size={16} />
              {stockLoading ? "Loading stock…" : addedItems.length === 0 ? "Add Paper Item" : "Add Another Paper"}
            </button>
          )}
        </div>

        {/* Save button */}
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={() => router.push("/paper-outward")}
            className="flex-1 border border-sand bg-white text-charcoal rounded-xl py-3 text-sm font-medium hover:bg-cream transition-colors">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={submitting || addedItems.length === 0 || !jobName.trim()}
            className="flex-1 bg-rust text-white rounded-xl py-3 text-sm font-semibold hover:bg-rust/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? "Saving…" : "Save Outward Entry"}
          </button>
        </div>
      </main>

      {/* Shortage popup */}
      {pendingForceAdjust && shortages.length > 0 && (
        <ShortageModal
          shortages={shortages}
          onYes={() => {
            setPendingForceAdjust(false);
            setShortages([]);
            submitOutward(true);
          }}
          onNo={() => {
            setPendingForceAdjust(false);
            setShortages([]);
          }}
        />
      )}
    </div>
  );
}
