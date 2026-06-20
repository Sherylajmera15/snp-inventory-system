"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";

interface InkStats {
  today: { entries: number; uv_ink: number; conv_ink: number; uv_varnish: number; conv_varnish: number; weight: number };
  month: { entries: number; weight: number };
  top_suppliers: { name: string; count: number }[];
}

function StatBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-cream rounded-xl p-3">
      <p className="text-xs text-taupe mb-1 truncate">{label}</p>
      <p className="text-base font-bold text-charcoal">{value}</p>
    </div>
  );
}

export default function InkAnalytics() {
  const [data, setData] = useState<InkStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/api/analytics/ink").then((r) => setData(r.data)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="bg-white border border-sand rounded-2xl p-5 mb-6 animate-pulse h-36" />;
  if (!data) return null;

  const t = data.today;

  return (
    <div className="bg-white border border-sand rounded-2xl p-5 mb-6 space-y-5">
      <div className="flex items-center gap-2">
        <span className="text-lg">🎨</span>
        <h3 className="text-sm font-semibold text-charcoal">Ink & Varnishes Analytics</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <p className="text-xs font-semibold text-taupe uppercase tracking-wide mb-2">Today</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <StatBox label="Entries" value={t.entries} />
            <StatBox label="UV Ink" value={t.uv_ink} />
            <StatBox label="Conv. Ink" value={t.conv_ink} />
            <StatBox label="UV Varnish" value={t.uv_varnish} />
            <StatBox label="Conv. Varnish" value={t.conv_varnish} />
            <StatBox label="Weight (kg)" value={t.weight.toFixed(2)} />
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold text-taupe uppercase tracking-wide mb-2">This Month</p>
          <div className="grid grid-cols-2 gap-2">
            <StatBox label="Total Entries" value={data.month.entries} />
            <StatBox label="Total Weight (kg)" value={data.month.weight.toFixed(2)} />
          </div>
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold text-taupe uppercase tracking-wide mb-2">Top Suppliers</p>
        {data.top_suppliers.length === 0
          ? <p className="text-xs text-taupe">No data yet.</p>
          : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {data.top_suppliers.slice(0, 6).map((s, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-rust/10 text-rust text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                  <span className="text-sm text-charcoal flex-1 truncate">{s.name}</span>
                  <span className="text-xs text-taupe">{s.count}</span>
                </div>
              ))}
            </div>
          )
        }
      </div>
    </div>
  );
}
