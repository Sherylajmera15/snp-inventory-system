"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";

interface SimpleStats {
  today: { entries: number; qty: number };
  month: { entries: number; qty: number };
  item_breakdown: { name: string; count: number; qty: number }[];
  top_suppliers: { name: string; count: number }[];
}

interface Props {
  endpoint: string;
  title: string;
  emoji: string;
  itemLabel: string;
  qtyUnit?: string;
}

function StatBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-cream rounded-xl p-3">
      <p className="text-xs text-taupe mb-1 truncate">{label}</p>
      <p className="text-base font-bold text-charcoal">{value}</p>
    </div>
  );
}

export default function SimpleAnalytics({ endpoint, title, emoji, itemLabel, qtyUnit = "" }: Props) {
  const [data, setData] = useState<SimpleStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(endpoint).then((r) => setData(r.data)).finally(() => setLoading(false));
  }, [endpoint]);

  if (loading) return <div className="bg-white border border-sand rounded-2xl p-5 mb-6 animate-pulse h-36" />;
  if (!data) return null;

  const maxCount = data.item_breakdown[0]?.count || 1;

  return (
    <div className="bg-white border border-sand rounded-2xl p-5 mb-6 space-y-5">
      <div className="flex items-center gap-2">
        <span className="text-lg">{emoji}</span>
        <h3 className="text-sm font-semibold text-charcoal">{title} Analytics</h3>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StatBox label="Entries Today" value={data.today.entries} />
        <StatBox label={`Qty Today${qtyUnit ? ` (${qtyUnit})` : ""}`} value={data.today.qty.toFixed(2)} />
        <StatBox label="Entries (Month)" value={data.month.entries} />
        <StatBox label={`Qty (Month)${qtyUnit ? ` (${qtyUnit})` : ""}`} value={data.month.qty.toFixed(2)} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-1">
        <div>
          <p className="text-xs font-semibold text-taupe uppercase tracking-wide mb-2">{itemLabel} Breakdown</p>
          {data.item_breakdown.length === 0
            ? <p className="text-xs text-taupe">No data yet.</p>
            : (
              <div className="space-y-1.5">
                {data.item_breakdown.slice(0, 7).map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="flex-1 bg-cream rounded-full h-1.5 overflow-hidden">
                      <div className="bg-rust h-1.5 rounded-full" style={{ width: `${Math.min(100, (item.count / maxCount) * 100)}%` }} />
                    </div>
                    <span className="text-xs text-charcoal w-32 truncate">{item.name}</span>
                    <span className="text-xs font-semibold text-charcoal w-8 text-right">{item.count}</span>
                  </div>
                ))}
              </div>
            )
          }
        </div>
        <div>
          <p className="text-xs font-semibold text-taupe uppercase tracking-wide mb-2">Top Suppliers</p>
          {data.top_suppliers.length === 0
            ? <p className="text-xs text-taupe">No data yet.</p>
            : (
              <ol className="space-y-1.5">
                {data.top_suppliers.slice(0, 5).map((s, i) => (
                  <li key={i} className="flex items-center gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-rust/10 text-rust text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                    <span className="text-sm text-charcoal flex-1 truncate">{s.name}</span>
                    <span className="text-xs text-taupe">{s.count} entries</span>
                  </li>
                ))}
              </ol>
            )
          }
        </div>
      </div>
    </div>
  );
}
