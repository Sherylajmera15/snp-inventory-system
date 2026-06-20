"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import AppHeader from "@/components/AppHeader";
import api from "@/lib/api";
import { AlertTriangle, CheckCircle, Plus, Search, Trash2 } from "lucide-react";
import { IssuedByInput, ReceivedByInput } from "@/components/AutocompleteInput";
import FIFOPreview, { FIFOBatch, groupsToFIFOBatches } from "@/components/FIFOPreview";

interface StockItem { item_name: string; unit: string; available_qty: number; }
interface ItemInput { item_name: string; unit: string; quantity_issued: number; }
interface Shortage { item_name: string; unit: string; available_qty: number; requested_qty: number; shortage_qty: number; }

function ShortageModal({ shortages, onYes, onNo }: { shortages: Shortage[]; onYes: () => void; onNo: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-amber-50 rounded-xl p-2"><AlertTriangle size={20} className="text-amber-600" /></div>
          <div><h2 className="text-base font-bold text-charcoal">Insufficient Stock</h2><p className="text-xs text-taupe">Some items exceed available stock.</p></div>
        </div>
        <div className="space-y-3 mb-5">
          {shortages.map((s, i) => (
            <div key={i} className="bg-amber-50 border border-amber-200 rounded-xl p-3">
              <p className="text-sm font-semibold text-charcoal">{s.item_name}</p>
              <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                <div><p className="text-amber-800 font-medium">Available</p><p className="font-bold text-charcoal">{s.available_qty} {s.unit}</p></div>
                <div><p className="text-amber-800 font-medium">Requested</p><p className="font-bold text-charcoal">{s.requested_qty} {s.unit}</p></div>
                <div><p className="text-amber-800 font-medium">Shortage</p><p className="font-bold text-red-600">{s.shortage_qty} {s.unit}</p></div>
              </div>
            </div>
          ))}
        </div>
        <p className="text-sm font-medium text-charcoal mb-1">Are you bringing this stock from another source?</p>
        <p className="text-xs text-taupe mb-4">If YES, an adjustment entry will be automatically created.</p>
        <div className="flex gap-3">
          <button onClick={onNo} className="flex-1 border border-sand bg-white text-charcoal rounded-xl py-2.5 text-sm font-medium hover:bg-cream transition-colors">No — Go Back</button>
          <button onClick={onYes} className="flex-1 bg-rust text-white rounded-xl py-2.5 text-sm font-medium hover:bg-rust/90 transition-colors">Yes — Create Adjustment</button>
        </div>
      </div>
    </div>
  );
}

function ItemPickerForm({ stockList, usedKeys, onAdd, onCancel }: {
  stockList: StockItem[];
  usedKeys: Set<string>;
  onAdd: (item: ItemInput) => void;
  onCancel: () => void;
}) {
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<StockItem | null>(null);
  const [qty, setQty] = useState<number | "">("");
  const [fifoBatches, setFifoBatches] = useState<FIFOBatch[]>([]);
  const [fifoLoading, setFifoLoading] = useState(false);

  const filtered = useMemo(() => {
    const q = filter.toLowerCase().trim();
    if (!q) return stockList;
    return stockList.filter((s) => s.item_name.toLowerCase().includes(q) || s.unit.toLowerCase().includes(q));
  }, [filter, stockList]);

  const alreadyAdded = selected ? usedKeys.has(`${selected.item_name}||${selected.unit}`) : false;

  return (
    <div className="bg-white border-2 border-rust/20 rounded-2xl p-5 space-y-4">
      <h3 className="text-sm font-bold text-charcoal">Select Oil / Lubricant</h3>
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-taupe pointer-events-none" />
        <input type="text" placeholder="Search…" value={filter} onChange={(e) => setFilter(e.target.value)}
          className="w-full rounded-xl border border-sand bg-cream/40 pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust" />
      </div>
      <div className="max-h-52 overflow-y-auto rounded-xl border border-sand divide-y divide-sand/50">
        {filtered.length === 0 && <p className="text-xs text-taupe text-center py-6">No items found in inward stock.</p>}
        {filtered.map((item) => {
          const key = `${item.item_name}||${item.unit}`;
          const isSel = selected?.item_name === item.item_name && selected?.unit === item.unit;
          const isUsed = usedKeys.has(key);
          return (
            <button key={key} type="button" onClick={() => {
                setSelected(item); setQty(""); setFifoBatches([]);
                setFifoLoading(true);
                api.get("/api/oil-outward/stock-containers", { params: { item_name: item.item_name, unit: item.unit } })
                  .then((r) => setFifoBatches(groupsToFIFOBatches(r.data.groups ?? [])))
                  .catch(() => setFifoBatches([]))
                  .finally(() => setFifoLoading(false));
              }} disabled={isUsed}
              className={`w-full flex items-center justify-between px-4 py-3 text-left text-sm transition-colors ${isUsed ? "opacity-40 cursor-not-allowed" : isSel ? "bg-rust/10" : "hover:bg-cream/60"}`}>
              <div>
                <p className="font-medium text-charcoal">{item.item_name}</p>
                <p className={`text-xs mt-0.5 ${item.available_qty > 0 ? "text-green-700" : "text-amber-700"}`}>
                  {item.available_qty > 0 ? `Available: ${item.available_qty} ${item.unit}` : `No stock · ${item.unit}`}
                </p>
              </div>
              {isUsed && <span className="text-xs text-taupe shrink-0 ml-2">Added</span>}
              {isSel && !isUsed && <CheckCircle size={14} className="text-rust shrink-0 ml-2" />}
            </button>
          );
        })}
      </div>

      {selected && !alreadyAdded && (
        <div className="space-y-3">
          <div className={`rounded-xl px-4 py-3 border ${selected.available_qty > 0 ? "bg-green-100 border-green-300" : "bg-amber-100 border-amber-300"}`}>
            <p className={`text-lg font-bold ${selected.available_qty > 0 ? "text-green-900" : "text-amber-900"}`}>
              Available: {selected.available_qty > 0 ? `${selected.available_qty} ${selected.unit}` : `0 ${selected.unit}`}
            </p>
          </div>
          {fifoLoading && <p className="text-xs text-taupe text-center py-2">Loading container breakdown…</p>}
          {!fifoLoading && fifoBatches.length > 0 && (
            <FIFOPreview
              batches={fifoBatches}
              unit={selected.unit}
              netConsumedSoFar={Math.max(0, fifoBatches.reduce((s, b) => s + b.totalQty, 0) - selected.available_qty)}
              newQty={qty}
            />
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-taupe mb-1.5">Quantity Issued</label>
              <input type="number" min={0.001} step={0.001} value={qty} onWheel={(e) => e.currentTarget.blur()}
                onChange={(e) => setQty(e.target.value === "" ? "" : parseFloat(e.target.value))} placeholder="e.g. 5"
                className="w-full rounded-xl border border-sand bg-cream/40 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust" />
            </div>
            <div>
              <label className="block text-xs font-medium text-taupe mb-1.5">Unit (Read Only)</label>
              <div className="w-full rounded-xl border border-sand bg-sand/20 px-3 py-2.5 text-sm text-charcoal font-semibold">{selected.unit}</div>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="flex-1 border border-sand bg-white text-charcoal rounded-xl py-2.5 text-sm font-medium hover:bg-cream transition-colors">Cancel</button>
        {selected && !alreadyAdded && (
          <button type="button" onClick={() => { if (selected && qty !== "" && Number(qty) > 0) onAdd({ item_name: selected.item_name, unit: selected.unit, quantity_issued: Number(qty) }); }}
            disabled={qty === "" || Number(qty) <= 0}
            className="flex-1 bg-rust text-white rounded-xl py-2.5 text-sm font-medium hover:bg-rust/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            Add to List
          </button>
        )}
      </div>
    </div>
  );
}

export default function OilOutwardNewPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);
  const nowTime = new Date().toTimeString().slice(0, 5);

  const [stockList, setStockList] = useState<StockItem[]>([]);
  const [stockLoading, setStockLoading] = useState(true);
  const [addedItems, setAddedItems] = useState<ItemInput[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [shortages, setShortages] = useState<Shortage[]>([]);
  const [pendingForce, setPendingForce] = useState(false);

  const [outwardDate, setOutwardDate] = useState(today);
  const [outwardTime, setOutwardTime] = useState(nowTime);
  const [machineName, setMachineName] = useState("");
  const [issuedBy, setIssuedBy] = useState("");
  const [receivedBy, setReceivedBy] = useState("");
  const [remarks, setRemarks] = useState("");

  useEffect(() => { if (!loading && !user) router.replace("/login"); }, [user, loading, router]);
  useEffect(() => {
    if (!user) return;
    api.get("/api/oil-outward/stock").then((r) => setStockList(r.data)).finally(() => setStockLoading(false));
  }, [user]);

  const usedKeys = useMemo(() => new Set(addedItems.map((i) => `${i.item_name}||${i.unit}`)), [addedItems]);

  async function submitOutward(force: boolean) {
    setSubmitting(true);
    try {
      const res = await api.post("/api/oil-outward", {
        outward_date: outwardDate, outward_time: outwardTime || null,
        machine_name: machineName.trim() || null,
        issued_by: issuedBy.trim() || null, received_by: receivedBy.trim() || null,
        remarks: remarks.trim() || null, items: addedItems, force_adjustment: force,
      });
      if (res.data.status === "stock_shortage") { setShortages(res.data.shortages); setPendingForce(true); return; }
      router.push("/oil-outward");
    } finally { setSubmitting(false); }
  }

  if (loading || !user) return <div className="min-h-screen flex items-center justify-center bg-cream"><p className="text-taupe">Loading...</p></div>;

  return (
    <div className="min-h-screen bg-cream">
      <AppHeader title="New Oil & Lubrication Outward" backHref="/oil-outward" />
      <main className="max-w-3xl mx-auto px-6 py-10 space-y-6">
        <div className="bg-white border border-sand rounded-2xl p-6 space-y-4">
          <h2 className="text-sm font-bold text-charcoal uppercase tracking-widest">Entry Details</h2>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-xs font-medium text-taupe mb-1.5">Date</label>
              <input type="date" value={outwardDate} onChange={(e) => setOutwardDate(e.target.value)} className="w-full rounded-xl border border-sand bg-cream/40 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust" /></div>
            <div><label className="block text-xs font-medium text-taupe mb-1.5">Time</label>
              <input type="time" value={outwardTime} onChange={(e) => setOutwardTime(e.target.value)} className="w-full rounded-xl border border-sand bg-cream/40 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust" /></div>
          </div>
          <div><label className="block text-xs font-medium text-taupe mb-1.5">Machine Name (Optional)</label>
            <input type="text" value={machineName} onChange={(e) => setMachineName(e.target.value)} placeholder="e.g. Offset Press 1" className="w-full rounded-xl border border-sand bg-cream/40 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust" /></div>
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
          <div><label className="block text-xs font-medium text-taupe mb-1.5">Remarks (Optional)</label>
            <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} placeholder="Any additional notes…" className="w-full rounded-xl border border-sand bg-cream/40 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust resize-none" /></div>
        </div>

        <div className="space-y-3">
          <h2 className="text-sm font-bold text-charcoal uppercase tracking-widest">Items to Issue</h2>
          {addedItems.length > 0 && (
            <div className="space-y-2">
              {addedItems.map((item, i) => (
                <div key={i} className="bg-white border border-sand rounded-xl px-4 py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <CheckCircle size={16} className="text-green-500 shrink-0" />
                    <p className="text-sm text-charcoal truncate">{item.item_name} — {item.quantity_issued} {item.unit}</p>
                  </div>
                  <button onClick={() => setAddedItems((prev) => prev.filter((_, j) => j !== i))} className="shrink-0 text-taupe hover:text-red-500 transition-colors"><Trash2 size={15} /></button>
                </div>
              ))}
            </div>
          )}
          {showAdd && !stockLoading
            ? <ItemPickerForm stockList={stockList} usedKeys={usedKeys} onAdd={(item) => { setAddedItems((prev) => [...prev, item]); setShowAdd(false); }} onCancel={() => setShowAdd(false)} />
            : <button type="button" onClick={() => setShowAdd(true)} disabled={stockLoading}
                className="w-full border-2 border-dashed border-sand rounded-2xl py-4 text-sm font-medium text-taupe hover:border-rust hover:text-rust transition-colors flex items-center justify-center gap-2">
                <Plus size={16} />{stockLoading ? "Loading stock…" : addedItems.length === 0 ? "Add Oil / Lubricant" : "Add Another Item"}
              </button>
          }
        </div>

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={() => router.push("/oil-outward")} className="flex-1 border border-sand bg-white text-charcoal rounded-xl py-3 text-sm font-medium hover:bg-cream transition-colors">Cancel</button>
          <button type="button" onClick={() => { if (addedItems.length === 0) { alert("Add at least one item."); return; } submitOutward(false); }}
            disabled={submitting || addedItems.length === 0}
            className="flex-1 bg-rust text-white rounded-xl py-3 text-sm font-semibold hover:bg-rust/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            {submitting ? "Saving…" : "Save Outward Entry"}
          </button>
        </div>
      </main>
      {pendingForce && shortages.length > 0 && (
        <ShortageModal shortages={shortages}
          onYes={() => { setPendingForce(false); setShortages([]); submitOutward(true); }}
          onNo={() => { setPendingForce(false); setShortages([]); }} />
      )}
    </div>
  );
}
