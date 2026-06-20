"use client";

// Represents one group of identically-sized containers/reels from a single inward batch
export interface FIFOBatch {
  count: number;      // number of containers or reels in this group
  qtyEach: number;    // quantity per container/reel
  totalQty: number;   // total quantity in this group (≈ count × qtyEach)
}

interface BatchResult extends FIFOBatch {
  consumedQty: number;
  fullyConsumedCount: number;
  partialConsumedQty: number;
  remainingFullCount: number;
  isFullyConsumed: boolean;
}

function applyFIFO(batches: FIFOBatch[], totalConsumed: number): BatchResult[] {
  let rem = totalConsumed;
  return batches.map((b) => {
    const consumed = Math.min(rem, b.totalQty);
    rem = Math.max(0, rem - b.totalQty);

    const fullPacks = b.qtyEach > 0 ? Math.floor(consumed / b.qtyEach + 0.0001) : 0;
    const partialQty = consumed - fullPacks * b.qtyEach;
    const hasPartial = partialQty > 0.001;
    const remainingFull = b.count - fullPacks - (hasPartial ? 1 : 0);

    return {
      ...b,
      consumedQty: consumed,
      fullyConsumedCount: fullPacks,
      partialConsumedQty: hasPartial ? partialQty : 0,
      remainingFullCount: Math.max(0, remainingFull),
      isFullyConsumed: consumed >= b.totalQty - 0.001,
    };
  });
}

function fmtQ(q: number): string {
  return Number.isInteger(q) ? String(q) : parseFloat(q.toFixed(3)).toString();
}

interface FIFOPreviewProps {
  batches: FIFOBatch[];
  unit: string;
  netConsumedSoFar: number;
  newQty: number | "";
  containerLabel?: string;
}

export default function FIFOPreview({
  batches,
  unit,
  netConsumedSoFar,
  newQty,
  containerLabel = "Container",
}: FIFOPreviewProps) {
  if (batches.length === 0) return null;

  const newQtyNum = newQty === "" ? 0 : Number(newQty);
  const currentState = applyFIFO(batches, netConsumedSoFar);
  const previewState = newQtyNum > 0 ? applyFIFO(batches, netConsumedSoFar + newQtyNum) : null;

  const totalInward = batches.reduce((s, b) => s + b.totalQty, 0);
  const totalContainers = batches.reduce((s, b) => s + b.count, 0);

  return (
    <div className="mt-3 rounded-xl border border-sand bg-white overflow-hidden text-xs">
      <div className="bg-cream/60 px-4 py-2 border-b border-sand flex items-center justify-between">
        <p className="font-bold text-charcoal uppercase tracking-wide">
          {previewState ? "FIFO Consumption Preview" : "Stock Breakdown (FIFO)"}
        </p>
        <p className="text-taupe">
          {totalContainers} {containerLabel}{totalContainers !== 1 ? "s" : ""} · {fmtQ(totalInward)} {unit} total
        </p>
      </div>

      <div className="divide-y divide-sand/40">
        {currentState.map((b, i) => {
          const prev = previewState ? previewState[i] : null;
          const batchLabel = batches.length === 1 ? `${containerLabel}s` : `Batch ${i + 1}`;
          const fillNow = b.totalQty > 0 ? b.consumedQty / b.totalQty : 0;
          const fillPrev = prev && b.totalQty > 0 ? prev.consumedQty / b.totalQty : fillNow;

          return (
            <div key={i} className={`px-4 py-3 space-y-2 ${b.isFullyConsumed ? "opacity-60" : ""}`}>
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold text-charcoal">
                  {batchLabel}: {b.count} × {fmtQ(b.qtyEach)} {unit}
                </span>
                {b.isFullyConsumed && (
                  <span className="text-red-500 font-semibold shrink-0">Fully Consumed</span>
                )}
                {!b.isFullyConsumed && b.consumedQty === 0 && (
                  <span className="text-green-600 shrink-0">Untouched</span>
                )}
              </div>

              <div className="h-1.5 bg-sand/40 rounded-full overflow-hidden">
                <div
                  className="h-1.5 rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, fillPrev * 100)}%`,
                    backgroundColor: b.isFullyConsumed ? "#ef4444" : fillNow > 0 ? "#f59e0b" : "#4ade80",
                  }}
                />
              </div>

              {!b.isFullyConsumed && b.consumedQty > 0 && (
                <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-taupe">
                  {b.fullyConsumedCount > 0 && (
                    <span className="text-red-500">
                      {b.fullyConsumedCount} {containerLabel}{b.fullyConsumedCount !== 1 ? "s" : ""} fully consumed
                    </span>
                  )}
                  {b.partialConsumedQty > 0 && (
                    <span className="text-amber-700">
                      1 partial ({fmtQ(b.partialConsumedQty)} {unit} used · {fmtQ(b.qtyEach - b.partialConsumedQty)} {unit} remaining)
                    </span>
                  )}
                  {b.remainingFullCount > 0 && (
                    <span className="text-green-700">
                      {b.remainingFullCount} {containerLabel}{b.remainingFullCount !== 1 ? "s" : ""} remaining
                    </span>
                  )}
                </div>
              )}

              {prev && newQtyNum > 0 && !b.isFullyConsumed && prev.consumedQty > b.consumedQty && (
                <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-1.5 text-amber-800">
                  After issuing {fmtQ(newQtyNum)} {unit}:{" "}
                  {prev.isFullyConsumed
                    ? <span className="font-semibold">Fully Consumed</span>
                    : <span>
                        {prev.fullyConsumedCount > b.fullyConsumedCount
                          ? `${prev.fullyConsumedCount - b.fullyConsumedCount} more fully consumed · `
                          : ""}
                        {prev.remainingFullCount} {containerLabel}{prev.remainingFullCount !== 1 ? "s" : ""} remaining
                      </span>
                  }
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Helper functions ─────────────────────────────────────────────────────────

export function groupsToFIFOBatches(
  groups: { number_of_packs: number; quantity_per_pack: number; group_quantity: number }[],
): FIFOBatch[] {
  return groups
    .filter((g) => g.number_of_packs > 0)
    .map((g) => ({
      count: Math.round(g.number_of_packs),
      qtyEach: g.quantity_per_pack,
      totalQty: g.group_quantity,
    }));
}

export function reelsToFIFOBatches(reels: { weight_kg: number }[]): FIFOBatch[] {
  const batches: FIFOBatch[] = [];
  for (const reel of reels) {
    const last = batches[batches.length - 1];
    if (last && Math.abs(last.qtyEach - reel.weight_kg) < 0.001) {
      last.count++;
      last.totalQty = parseFloat((last.totalQty + reel.weight_kg).toFixed(3));
    } else {
      batches.push({ count: 1, qtyEach: reel.weight_kg, totalQty: reel.weight_kg });
    }
  }
  return batches;
}
