"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import AppHeader from "@/components/AppHeader";
import { IssuedByInput, ReceivedByInput } from "@/components/AutocompleteInput";
import FIFOPreview, { FIFOBatch, groupsToFIFOBatches } from "@/components/FIFOPreview";
import api from "@/lib/api";
import { GenericStockItem, GenericOutwardItemInput, GenericStockShortage, OutwardModuleConfig } from "@/types/generic-outward";
import { AlertTriangle, CheckCircle, Plus, Search, Trash2 } from "lucide-react";

// ─── Shortage Modal ────────────────────────────────────────────────────────────

function ShortageModal({
  shortages, onYes, onNo,
}: {
  shortages: GenericStockShortage[];
  onYes: () => void;
  onNo: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-amber-50 rounded-xl p-2"><AlertTriangle size={20} className="text-amber-600" /></div>
          <div>
            <h2 className="text-base font-bold text-charcoal">Insufficient Stock</h2>
            <p className="text-xs text-taupe">Some items exceed available stock.</p>
          </div>
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
        <p className="text-sm text-charcoal mb-1 font-medium">Are you bringing this stock from another source?</p>
        <p className="text-xs text-taupe mb-4">If YES, an adjustment entry will be automatically created for the shortage amount.</p>
        <div className="flex gap-3">
          <button onClick={onNo} className="flex-1 border border-sand bg-white text-charcoal rounded-xl py-2.5 text-sm font-medium hover:bg-cream transition-colors">No — Go Back</button>
          <button onClick={onYes} className="flex-1 bg-rust text-white rounded-xl py-2.5 text-sm font-medium hover:bg-rust/90 transition-colors">Yes — Create Adjustment</button>
        </div>
      </div>
    </div>
  );
}

// ─── Item Picker Form ─────────────────────────────────────────────────────────

function ItemPickerForm({
  stockList,
  usedKeys,
  apiPrefix,
  onAdd,
  onCancel,
}: {
  stockList: GenericStockItem[];
  usedKeys: Set<string>;
  apiPrefix: string;
  onAdd: (item: GenericOutwardItemInput) => void;
  onCancel: () => void;
}) {
  const [filterText, setFilterText] = useState("");
  const [selected, setSelected] = useState<GenericStockItem | null>(null);
  const [qty, setQty] = useState<number | "">("");
  const [fifoBatches, setFifoBatches] = useState<FIFOBatch[]>([]);
  const [fifoLoading, setFifoLoading] = useState(false);

  const filtered = useMemo(() => {
    if (!filterText.trim()) return stockList;
    const q = filterText.toLowerCase();
    return stockList.filter((s) => s.item_name.toLowerCase().includes(q) || s.unit.toLowerCase().includes(q));
  }, [filterText, stockList]);

  const selectedKey = selected ? `${selected.item_name}||${selected.unit}` : null;
  const alreadyAdded = selectedKey ? usedKeys.has(selectedKey) : false;

  function handleSelect(item: GenericStockItem) {
    setSelected(item);
    setQty("");
    setFifoBatches([]);
    setFifoLoading(true);
    api.get(`${apiPrefix}/stock-containers`, { params: { item_name: item.item_name, unit: item.unit } })
      .then((r) => {
        setFifoBatches(groupsToFIFOBatches(r.data.groups ?? []));
      })
      .catch(() => setFifoBatches([]))
      .finally(() => setFifoLoading(false));
  }

  const totalInward = fifoBatches.reduce((s, b) => s + b.totalQty, 0);
  const netConsumedSoFar = selected ? Math.max(0, totalInward - selected.available_qty) : 0;

  function handleAdd() {
    if (!selected || qty === "" || qty <= 0 || alreadyAdded) return;
    onAdd({ item_name: selected.item_name, unit: selected.unit, quantity_issued: Number(qty) });
  }

  return (
    <div className="bg-white border-2 border-rust/20 rounded-2xl p-5 space-y-4">
      <h3 className="text-sm font-bold text-charcoal">Select Item</h3>

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-taupe pointer-events-none" />
        <input type="text" placeholder="Search items…" value={filterText} onChange={(e) => setFilterText(e.target.value)}
          className="w-full rounded-xl border border-sand bg-cream/40 pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust" />
      </div>

      <div className="max-h-52 overflow-y-auto rounded-xl border border-sand divide-y divide-sand/50">
        {filtered.length === 0 && <p className="text-xs text-taupe text-center py-6">No items found.</p>}
        {filtered.map((item) => {
          const key = `${item.item_name}||${item.unit}`;
          const isSelected = selected?.item_name === item.item_name && selected?.unit === item.unit;
          const isUsed = usedKeys.has(key);
          const hasStock = item.available_qty > 0;
          return (
            <button key={key} type="button" onClick={() => { if (!isUsed) handleSelect(item); }}
              disabled={isUsed}
              className={`w-full flex items-center justify-between px-4 py-3 text-left text-sm transition-colors ${
                isUsed ? "opacity-40 cursor-not-allowed bg-cream/30" :
                isSelected ? "bg-rust/10" : "hover:bg-cream/60"
              }`}>
              <div className="min-w-0">
                <p className="font-medium text-charcoal truncate">{item.item_name}</p>
                <p className={`text-xs mt-0.5 ${hasStock ? "text-green-700" : "text-amber-700"}`}>
                  {hasStock ? `Available: ${item.available_qty} ${item.unit}` : `No stock · ${item.unit}`}
                </p>
              </div>
              {isUsed && <span className="text-xs text-taupe shrink-0 ml-2">Added</span>}
              {isSelected && !isUsed && <CheckCircle size={14} className="text-rust shrink-0 ml-2" />}
            </button>
          );
        })}
      </div>

      {selected && !alreadyAdded && (
        <div className="space-y-3">
          <div className={`rounded-xl px-4 py-3 border ${selected.available_qty > 0 ? "bg-green-100 border-green-300" : "bg-amber-100 border-amber-300"}`}>
            <p className={`text-lg font-bold ${selected.available_qty > 0 ? "text-green-900" : "text-amber-900"}`}>
              Available: {selected.available_qty > 0 ? `${selected.available_qty} ${selected.unit}` : `0 ${selected.unit} (shortage may be created)`}
            </p>
          </div>

          {/* FIFO container breakdown */}
          {fifoLoading && <p className="text-xs text-taupe text-center py-2">Loading container breakdown…</p>}
          {!fifoLoading && fifoBatches.length > 0 && (
            <FIFOPreview
              batches={fifoBatches}
              unit={selected.unit}
              netConsumedSoFar={netConsumedSoFar}
              newQty={qty}
            />
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-taupe mb-1.5">Quantity Issued</label>
              <input type="number" min={0.001} step={0.001} value={qty}
                onChange={(e) => setQty(e.target.value === "" ? "" : parseFloat(e.target.value))}
                onWheel={(e) => e.currentTarget.blur()}
                placeholder="e.g. 35"
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
          <button type="button" onClick={handleAdd} disabled={qty === "" || Number(qty) <= 0}
            className="flex-1 bg-rust text-white rounded-xl py-2.5 text-sm font-medium hover:bg-rust/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            Add to List
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function GenericOutwardNew({ config }: { config: OutwardModuleConfig }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  const today = new Date().toISOString().slice(0, 10);
  const nowTime = new Date().toTimeString().slice(0, 5);

  const [stockList, setStockList] = useState<GenericStockItem[]>([]);
  const [stockLoading, setStockLoading] = useState(true);
  const [addedItems, setAddedItems] = useState<GenericOutwardItemInput[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [shortages, setShortages] = useState<GenericStockShortage[]>([]);
  const [pendingForce, setPendingForce] = useState(false);

  const [outwardDate, setOutwardDate] = useState(today);
  const [outwardTime, setOutwardTime] = useState(nowTime);
  const [issuedBy, setIssuedBy] = useState("");
  const [receivedBy, setReceivedBy] = useState("");
  const [remarks, setRemarks] = useState("");

  useEffect(() => { if (!loading && !user) router.replace("/login"); }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    api.get(`${config.apiPrefix}/stock`)
      .then((r) => setStockList(r.data))
      .finally(() => setStockLoading(false));
  }, [user, config.apiPrefix]);

  const usedKeys = useMemo(
    () => new Set(addedItems.map((i) => `${i.item_name}||${i.unit}`)),
    [addedItems],
  );

  async function submitOutward(forceAdjustment: boolean) {
    setSubmitting(true);
    try {
      const res = await api.post(config.apiPrefix, {
        outward_date: outwardDate, outward_time: outwardTime || null,
        issued_by: issuedBy.trim() || null, received_by: receivedBy.trim() || null,
        remarks: remarks.trim() || null, items: addedItems, force_adjustment: forceAdjustment,
      });
      if (res.data.status === "stock_shortage") { setShortages(res.data.shortages); setPendingForce(true); return; }
      router.push(config.routeBase);
    } finally { setSubmitting(false); }
  }

  if (loading || !user) return <div className="min-h-screen flex items-center justify-center bg-cream"><p className="text-taupe">Loading...</p></div>;

  return (
    <div className="min-h-screen bg-cream">
      <AppHeader title={`New ${config.title} Outward`} backHref={config.routeBase} />

      <main className="max-w-3xl mx-auto px-6 py-10 space-y-6">
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
            <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} placeholder="Any additional notes…"
              className="w-full rounded-xl border border-sand bg-cream/40 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust resize-none" />
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="text-sm font-bold text-charcoal uppercase tracking-widest">Items to Issue</h2>
          {addedItems.length > 0 && (
            <div className="space-y-2">
              {addedItems.map((item, i) => (
                <div key={i} className="bg-white border border-sand rounded-xl px-4 py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <CheckCircle size={16} className="text-green-500 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-charcoal truncate">{item.item_name}</p>
                      <p className="text-xs text-taupe">{item.quantity_issued} {item.unit}</p>
                    </div>
                  </div>
                  <button onClick={() => setAddedItems((prev) => prev.filter((_, j) => j !== i))}
                    className="shrink-0 text-taupe hover:text-red-500 transition-colors">
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {showAddForm && !stockLoading ? (
            <ItemPickerForm
              stockList={stockList}
              usedKeys={usedKeys}
              apiPrefix={config.apiPrefix}
              onAdd={(item) => { setAddedItems((prev) => [...prev, item]); setShowAddForm(false); }}
              onCancel={() => setShowAddForm(false)}
            />
          ) : (
            <button type="button" onClick={() => setShowAddForm(true)} disabled={stockLoading}
              className="w-full border-2 border-dashed border-sand rounded-2xl py-4 text-sm font-medium text-taupe hover:border-rust hover:text-rust transition-colors flex items-center justify-center gap-2">
              <Plus size={16} />
              {stockLoading ? "Loading stock…" : addedItems.length === 0 ? `Add ${config.title} Item` : "Add Another Item"}
            </button>
          )}
        </div>

        {addedItems.length > 0 && (
          <div className="bg-white border border-sand rounded-xl px-5 py-3">
            <p className="text-sm text-taupe">{addedItems.length} item{addedItems.length > 1 ? "s" : ""} to issue</p>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={() => router.push(config.routeBase)}
            className="flex-1 border border-sand bg-white text-charcoal rounded-xl py-3 text-sm font-medium hover:bg-cream transition-colors">
            Cancel
          </button>
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
