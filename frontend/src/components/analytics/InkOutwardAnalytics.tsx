"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { InkOutwardAnalytics } from "@/types/ink-outward";

function StatBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-cream rounded-xl p-3">
      <p className="text-xs text-taupe mb-1 truncate">{label}</p>
      <p className="text-base font-bold text-charcoal">{value}</p>
    </div>
  );
}

function BreakdownBar({ items, maxVal }: { items: { label: string; total_kg: number }[]; maxVal: number }) {
  return (
    <div className="space-y-1.5">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="flex-1 bg-cream rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-rust h-1.5 rounded-full"
              style={{ width: `${Math.min(100, (item.total_kg / maxVal) * 100)}%` }}
            />
          </div>
          <span className="text-xs text-charcoal w-32 truncate">{item.label}</span>
          <span className="text-xs font-semibold text-charcoal w-16 text-right">
            {item.total_kg.toLocaleString()} Kg
          </span>
        </div>
      ))}
    </div>
  );
}

export default function InkOutwardAnalyticsComponent() {
  const [data, setData] = useState<InkOutwardAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/api/ink-outward/analytics")
      .then((r) => setData(r.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="bg-white border border-sand rounded-2xl p-5 mb-6 animate-pulse h-40" />;
  if (!data) return null;

  const maxColor = Math.max(...data.color_breakdown.map((x) => x.total_kg), 1);
  const maxVarnish = Math.max(...data.varnish_breakdown.map((x) => x.total_kg), 1);

  return (
    <div className="bg-white border border-sand rounded-2xl p-5 mb-6 space-y-5">
      <div className="flex items-center gap-2">
        <span className="text-lg">🎨</span>
        <h3 className="text-sm font-semibold text-charcoal">Ink & Varnishes Outward Analytics</h3>
      </div>

      {/* Stat boxes */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <StatBox label="Entries Today" value={data.today.total_entries} />
        <StatBox label="Ink Today" value={`${data.today.total_ink_kg.toLocaleString()} Kg`} />
        <StatBox label="Varnish Today" value={`${data.today.total_varnish_kg.toLocaleString()} Kg`} />
        <StatBox label="Entries (Month)" value={data.month.total_entries} />
        <StatBox label="Ink (Month)" value={`${data.month.total_ink_kg.toLocaleString()} Kg`} />
        <StatBox label="Varnish (Month)" value={`${data.month.total_varnish_kg.toLocaleString()} Kg`} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-1">
        {/* Color breakdown */}
        <div>
          <p className="text-xs font-semibold text-taupe uppercase tracking-wide mb-2">Color Breakdown</p>
          {data.color_breakdown.length === 0
            ? <p className="text-xs text-taupe">No ink outward data yet.</p>
            : <BreakdownBar items={data.color_breakdown} maxVal={maxColor} />}
        </div>

        {/* Varnish breakdown */}
        <div>
          <p className="text-xs font-semibold text-taupe uppercase tracking-wide mb-2">Varnish Breakdown</p>
          {data.varnish_breakdown.length === 0
            ? <p className="text-xs text-taupe">No varnish outward data yet.</p>
            : <BreakdownBar items={data.varnish_breakdown} maxVal={maxVarnish} />}
        </div>

        {/* Top consumed */}
        <div>
          <p className="text-xs font-semibold text-taupe uppercase tracking-wide mb-2">Top Consumed</p>
          {data.top_consumed.length === 0
            ? <p className="text-xs text-taupe">No outward data yet.</p>
            : (
              <ol className="space-y-1.5">
                {data.top_consumed.slice(0, 5).map((item, i) => (
                  <li key={i} className="flex items-center gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-rust/10 text-rust text-xs font-bold flex items-center justify-center shrink-0">
                      {i + 1}
                    </span>
                    <span className="text-xs text-charcoal flex-1 truncate">{item.label}</span>
                    <span className="text-xs text-taupe whitespace-nowrap">{item.total_kg.toLocaleString()} Kg</span>
                  </li>
                ))}
              </ol>
            )}
        </div>
      </div>
    </div>
  );
}
