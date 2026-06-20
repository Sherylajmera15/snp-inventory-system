"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import AppHeader from "@/components/AppHeader";
import api from "@/lib/api";
import { InkStockItem, InkOutwardItemInput, InkStockShortage } from "@/types/ink-outward";
import { AlertTriangle, CheckCircle, Plus, Trash2 } from "lucide-react";
import { IssuedByInput, ReceivedByInput } from "@/components/AutocompleteInput";

// ─── Constants ────────────────────────────────────────────────────────────────

const UV_INK_COLORS = ["Cyan", "Magenta", "Yellow", "Black", "White", "Spot/Pantone"];
const CONV_INK_COLORS = ["Cyan", "Magenta", "Yellow", "Black", "Spot/Pantone"];
const UV_VARNISHES = ["Full UV", "Texture UV", "Matte Ink", "Matte UV", "Other"];
const CONV_VARNISHES = ["Waterbase Gloss", "Waterbase Matte", "Waterbase Primer", "Matpet Primer", "Other"];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function itemKey(item: InkOutwardItemInput) {
  return `${item.item_type}||${item.category}||${item.color ?? ""}||${item.pantone_number ?? ""}||${item.varnish_type ?? ""}`;
}

function itemLabel(item: InkOutwardItemInput): string {
  const totalWeight = (item.containers_issued * item.weight_per_container).toFixed(2);
  if (item.category === "Ink") {
    const colorStr = item.color === "Spot/Pantone" && item.pantone_number
      ? `Spot/Pantone (${item.pantone_number})`
      : item.color;
    return `${item.item_type} — ${colorStr}: ${item.containers_issued} containers × ${item.weight_per_container} Kg = ${totalWeight} Kg`;
  }
  const prefix = item.item_type === "UV Ink" ? "UV" : "Conventional";
  return `${prefix} Varnish — ${item.varnish_type}: ${item.containers_issued} containers × ${item.weight_per_container} Kg = ${totalWeight} Kg`;
}

// ─── Shortage Modal ───────────────────────────────────────────────────────────

function ShortageModal({
  shortages, onYes, onNo,
}: {
  shortages: InkStockShortage[];
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
            const label = s.category === "Ink"
              ? `${s.item_type} — ${s.color}${s.pantone_number ? ` (${s.pantone_number})` : ""}`
              : `${s.item_type === "UV Ink" ? "UV" : "Conventional"} Varnish — ${s.varnish_type}`;
            return (
              <div key={i} className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                <p className="text-sm font-semibold text-charcoal">{label}</p>
                <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                  <div><p className="text-taupe">Available</p><p className="font-bold text-charcoal">{s.available_kg} Kg</p></div>
                  <div><p className="text-taupe">Requested</p><p className="font-bold text-charcoal">{s.requested_kg} Kg</p></div>
                  <div><p className="text-taupe">Shortage</p><p className="font-bold text-red-600">{s.shortage_kg} Kg</p></div>
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-sm text-charcoal mb-2 font-medium">Are you bringing this stock from another source?</p>
        <p className="text-xs text-taupe mb-4">If YES, an adjustment entry will be automatically created for the shortage amount.</p>
        <div className="flex gap-3">
          <button onClick={onNo} className="flex-1 border border-sand bg-white text-charcoal rounded-xl py-2.5 text-sm font-medium hover:bg-cream transition-colors">
            No — Go Back
          </button>
          <button onClick={onYes} className="flex-1 bg-rust text-white rounded-xl py-2.5 text-sm font-medium hover:bg-rust/90 transition-colors">
            Yes — Create Adjustment
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Step Button ──────────────────────────────────────────────────────────────

function StepBtn({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className={`flex-1 rounded-xl border py-2.5 text-sm font-medium transition-colors ${
        selected ? "bg-rust text-white border-rust" : "bg-white text-charcoal border-sand hover:bg-cream"
      }`}>
      {label}
    </button>
  );
}

// ─── Add Item Form ────────────────────────────────────────────────────────────

function AddItemForm({
  stockList,
  usedKeys,
  onAdd,
  onCancel,
}: {
  stockList: InkStockItem[];
  usedKeys: Set<string>;
  onAdd: (item: InkOutwardItemInput) => void;
  onCancel: () => void;
}) {
  const [itemType, setItemType] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(null);
  const [pantoneNumber, setPantoneNumber] = useState("");
  const [varnishType, setVarnishType] = useState<string | null>(null);
  const [customVarnish, setCustomVarnish] = useState("");
  const [containers, setContainers] = useState<number | "">("");
  const [weightPerContainer, setWeightPerContainer] = useState<number | "">("");

  const colors = itemType === "UV Ink" ? UV_INK_COLORS : CONV_INK_COLORS;
  const varnishes = itemType === "UV Ink" ? UV_VARNISHES : CONV_VARNISHES;

  const effectiveVarnishType = varnishType === "Other"
    ? (customVarnish.trim() || null)
    : varnishType;

  const effectiveColor = color;
  const effectivePantone = color === "Spot/Pantone" ? (pantoneNumber.trim() || null) : null;

  const step1Done = !!itemType;
  const step2Done = step1Done && !!category;
  const step3Done = step2Done && (
    (category === "Ink" && !!color && (color !== "Spot/Pantone" || !!pantoneNumber.trim())) ||
    (category === "Varnish" && !!effectiveVarnishType)
  );

  const matchingStock = useMemo(() => {
    if (!step3Done) return null;
    return stockList.find(s =>
      s.item_type === itemType &&
      s.category === category &&
      (category === "Ink"
        ? s.color === effectiveColor && (s.pantone_number ?? null) === (effectivePantone ?? null)
        : s.varnish_type === effectiveVarnishType)
    ) ?? null;
  }, [stockList, itemType, category, effectiveColor, effectivePantone, effectiveVarnishType, step3Done]);

  const totalWeight = containers !== "" && weightPerContainer !== ""
    ? parseFloat(((containers as number) * (weightPerContainer as number)).toFixed(2))
    : 0;

  const currentKey = step3Done ? `${itemType}||${category}||${effectiveColor ?? ""}||${effectivePantone ?? ""}||${effectiveVarnishType ?? ""}` : null;
  const alreadyAdded = currentKey ? usedKeys.has(currentKey) : false;

  function resetFromStep(step: 1 | 2 | 3) {
    if (step <= 1) { setItemType(null); }
    if (step <= 2) { setCategory(null); }
    if (step <= 3) { setColor(null); setPantoneNumber(""); setVarnishType(null); setCustomVarnish(""); }
    setContainers(""); setWeightPerContainer("");
  }

  function handleAdd() {
    if (!step3Done || containers === "" || weightPerContainer === "" || totalWeight <= 0 || alreadyAdded) return;
    onAdd({
      item_type: itemType!,
      category: category!,
      color: category === "Ink" ? effectiveColor : null,
      pantone_number: category === "Ink" ? effectivePantone : null,
      varnish_type: category === "Varnish" ? effectiveVarnishType : null,
      containers_issued: Number(containers),
      weight_per_container: Number(weightPerContainer),
    });
  }

  return (
    <div className="bg-white border-2 border-rust/20 rounded-2xl p-5 space-y-5">
      <h3 className="text-sm font-bold text-charcoal">Add Ink / Varnish Item</h3>

      {/* Step 1: item type */}
      <div>
        <p className="text-xs font-medium text-taupe mb-2">Step 1 — Select Type</p>
        <div className="flex gap-2">
          {["UV Ink", "Conventional Ink"].map((t) => (
            <StepBtn key={t} label={t} selected={itemType === t}
              onClick={() => { setItemType(t); resetFromStep(2); }} />
          ))}
        </div>
      </div>

      {/* Step 2: category */}
      {step1Done && (
        <div>
          <p className="text-xs font-medium text-taupe mb-2">Step 2 — Select Category</p>
          <div className="flex gap-2">
            {["Ink", "Varnish"].map((c) => (
              <StepBtn key={c} label={c} selected={category === c}
                onClick={() => { setCategory(c); resetFromStep(3); }} />
            ))}
          </div>
        </div>
      )}

      {/* Step 3: color or varnish type */}
      {step2Done && category === "Ink" && (
        <div>
          <p className="text-xs font-medium text-taupe mb-2">Step 3 — Select Color</p>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {colors.map((c) => (
              <button key={c} type="button" onClick={() => { setColor(c); setPantoneNumber(""); setContainers(""); setWeightPerContainer(""); }}
                className={`rounded-xl border py-2 text-sm font-medium transition-colors text-center ${
                  color === c ? "bg-rust text-white border-rust" : "bg-white text-charcoal border-sand hover:bg-cream"
                }`}>
                {c}
              </button>
            ))}
          </div>
          {color === "Spot/Pantone" && (
            <div className="mt-3">
              <label className="text-xs text-taupe font-medium">Pantone Number</label>
              <input type="text" value={pantoneNumber} onChange={(e) => setPantoneNumber(e.target.value)}
                placeholder="e.g. PMS 485 C"
                className="mt-1 w-full rounded-xl border border-sand bg-cream/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust" />
            </div>
          )}
        </div>
      )}

      {step2Done && category === "Varnish" && (
        <div>
          <p className="text-xs font-medium text-taupe mb-2">Step 3 — Select Varnish Type</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {varnishes.map((v) => (
              <button key={v} type="button" onClick={() => { setVarnishType(v); setCustomVarnish(""); setContainers(""); setWeightPerContainer(""); }}
                className={`rounded-xl border py-2 text-sm font-medium transition-colors text-center ${
                  varnishType === v ? "bg-rust text-white border-rust" : "bg-white text-charcoal border-sand hover:bg-cream"
                }`}>
                {v}
              </button>
            ))}
          </div>
          {varnishType === "Other" && (
            <div className="mt-3">
              <label className="text-xs text-taupe font-medium">Custom Varnish Type</label>
              <input type="text" value={customVarnish} onChange={(e) => setCustomVarnish(e.target.value)}
                placeholder="Enter varnish type…"
                className="mt-1 w-full rounded-xl border border-sand bg-cream/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust" />
            </div>
          )}
        </div>
      )}

      {/* Available stock info */}
      {step3Done && (
        <div className={`rounded-xl px-4 py-3 border text-sm ${
          matchingStock && matchingStock.available_weight_kg > 0
            ? "bg-green-100 border-green-300"
            : "bg-amber-100 border-amber-300"
        }`}>
          {matchingStock ? (
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-green-800 uppercase tracking-wide">Available Stock</p>
                <p className="text-lg font-bold text-green-900 mt-0.5">{matchingStock.available_weight_kg.toLocaleString()} Kg</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-semibold text-green-800 uppercase tracking-wide">Approx. Containers</p>
                <p className="text-lg font-bold text-green-900 mt-0.5">{Math.max(0, matchingStock.available_containers)}</p>
              </div>
            </div>
          ) : (
            <p className="text-amber-900 text-xs font-semibold">No inward stock found for this item. Proceeding will require an adjustment entry.</p>
          )}
          {alreadyAdded && <p className="text-red-700 text-xs mt-2 font-semibold">This item is already in the list. Remove it first to re-add.</p>}
        </div>
      )}

      {/* Quantity inputs */}
      {step3Done && !alreadyAdded && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-taupe mb-1.5">Containers to Issue</label>
            <input type="number" min={1} step={1} value={containers}
              onChange={(e) => setContainers(e.target.value === "" ? "" : parseInt(e.target.value, 10))}
              onWheel={(e) => e.currentTarget.blur()}
              placeholder="e.g. 3"
              className="w-full rounded-xl border border-sand bg-cream/40 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust" />
          </div>
          <div>
            <label className="block text-xs font-medium text-taupe mb-1.5">Weight per Container (Kg)</label>
            <input type="number" min={0.01} step={0.01} value={weightPerContainer}
              onChange={(e) => setWeightPerContainer(e.target.value === "" ? "" : parseFloat(e.target.value))}
              onWheel={(e) => e.currentTarget.blur()}
              placeholder="e.g. 20"
              className="w-full rounded-xl border border-sand bg-cream/40 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust" />
          </div>
        </div>
      )}

      {/* Total display */}
      {step3Done && !alreadyAdded && totalWeight > 0 && (
        <div className="bg-rust/5 border border-rust/20 rounded-xl px-4 py-2.5 flex items-center justify-between">
          <p className="text-sm text-taupe">Total Weight to Issue</p>
          <p className="text-base font-bold text-rust">{totalWeight.toLocaleString()} Kg</p>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onCancel}
          className="flex-1 border border-sand bg-white text-charcoal rounded-xl py-2.5 text-sm font-medium hover:bg-cream transition-colors">
          Cancel
        </button>
        {step3Done && !alreadyAdded && (
          <button type="button" onClick={handleAdd}
            disabled={containers === "" || weightPerContainer === "" || totalWeight <= 0}
            className="flex-1 bg-rust text-white rounded-xl py-2.5 text-sm font-medium hover:bg-rust/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            Add to List
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function InkOutwardNewPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const today = new Date().toISOString().slice(0, 10);
  const nowTime = new Date().toTimeString().slice(0, 5);

  const [stockList, setStockList] = useState<InkStockItem[]>([]);
  const [stockLoading, setStockLoading] = useState(true);
  const [addedItems, setAddedItems] = useState<InkOutwardItemInput[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [shortages, setShortages] = useState<InkStockShortage[]>([]);
  const [pendingForceAdjust, setPendingForceAdjust] = useState(false);

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
    api.get("/api/ink-outward/stock")
      .then((r) => setStockList(r.data))
      .finally(() => setStockLoading(false));
  }, [user]);

  const usedKeys = useMemo(() => new Set(addedItems.map(itemKey)), [addedItems]);

  function handleAddItem(item: InkOutwardItemInput) {
    setAddedItems((prev) => [...prev, item]);
    setShowAddForm(false);
  }

  function handleRemoveItem(idx: number) {
    setAddedItems((prev) => prev.filter((_, i) => i !== idx));
  }

  async function submitOutward(forceAdjustment: boolean) {
    setSubmitting(true);
    try {
      const res = await api.post("/api/ink-outward", {
        outward_date: outwardDate,
        outward_time: outwardTime || null,
        job_name: jobName.trim() || null,
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

      router.push("/ink-outward");
    } finally {
      setSubmitting(false);
    }
  }

  function handleSave() {
    if (addedItems.length === 0) { alert("Add at least one ink/varnish item."); return; }
    submitOutward(false);
  }

  if (loading || !user) {
    return <div className="min-h-screen flex items-center justify-center bg-cream"><p className="text-taupe">Loading...</p></div>;
  }

  return (
    <div className="min-h-screen bg-cream">
      <AppHeader title="New Ink & Varnishes Outward" backHref="/ink-outward" />

      <main className="max-w-3xl mx-auto px-6 py-10 space-y-6">

        {/* Header info */}
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
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-taupe mb-1.5">Job Name (Optional)</label>
              <input type="text" value={jobName} onChange={(e) => setJobName(e.target.value)}
                placeholder="e.g. Syncom Carton"
                className="w-full rounded-xl border border-sand bg-cream/40 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust" />
            </div>
            <div>
              <label className="block text-xs font-medium text-taupe mb-1.5">Job Card Number (Optional)</label>
              <input type="text" value={jobCardNumber} onChange={(e) => setJobCardNumber(e.target.value)}
                placeholder="e.g. JC-001"
                className="w-full rounded-xl border border-sand bg-cream/40 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust" />
            </div>
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

        {/* Items section */}
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-charcoal uppercase tracking-widest">Items to Issue</h2>

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

          {showAddForm && !stockLoading ? (
            <AddItemForm
              stockList={stockList}
              usedKeys={usedKeys}
              onAdd={handleAddItem}
              onCancel={() => setShowAddForm(false)}
            />
          ) : (
            <button type="button" onClick={() => setShowAddForm(true)} disabled={stockLoading}
              className="w-full border-2 border-dashed border-sand rounded-2xl py-4 text-sm font-medium text-taupe hover:border-rust hover:text-rust transition-colors flex items-center justify-center gap-2">
              <Plus size={16} />
              {stockLoading ? "Loading stock…" : addedItems.length === 0 ? "Add Ink / Varnish Item" : "Add Another Item"}
            </button>
          )}
        </div>

        {/* Summary */}
        {addedItems.length > 0 && (
          <div className="bg-white border border-sand rounded-xl px-5 py-3 flex items-center justify-between">
            <p className="text-sm text-taupe">{addedItems.length} item{addedItems.length > 1 ? "s" : ""}</p>
            <p className="text-sm font-bold text-charcoal">
              Total: {addedItems.reduce((acc, i) => acc + i.containers_issued * i.weight_per_container, 0).toFixed(2)} Kg
            </p>
          </div>
        )}

        {/* Save / Cancel */}
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={() => router.push("/ink-outward")}
            className="flex-1 border border-sand bg-white text-charcoal rounded-xl py-3 text-sm font-medium hover:bg-cream transition-colors">
            Cancel
          </button>
          <button type="button" onClick={handleSave}
            disabled={submitting || addedItems.length === 0}
            className="flex-1 bg-rust text-white rounded-xl py-3 text-sm font-semibold hover:bg-rust/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            {submitting ? "Saving…" : "Save Outward Entry"}
          </button>
        </div>
      </main>

      {pendingForceAdjust && shortages.length > 0 && (
        <ShortageModal
          shortages={shortages}
          onYes={() => { setPendingForceAdjust(false); setShortages([]); submitOutward(true); }}
          onNo={() => { setPendingForceAdjust(false); setShortages([]); }}
        />
      )}
    </div>
  );
}
