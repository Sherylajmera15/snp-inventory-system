"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { CTPOutwardAnalytics } from "@/types/ctp-outward";

function StatBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-cream rounded-xl p-3">
      <p className="text-xs text-taupe mb-1 truncate">{label}</p>
      <p className="text-base font-bold text-charcoal">{value}</p>
    </div>
  );
}

export default function CTPOutwardAnalyticsComponent() {
  const [data, setData] = useState<CTPOutwardAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/api/ctp-outward/analytics")
      .then((r) => setData(r.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="bg-white border border-sand rounded-2xl p-5 mb-6 animate-pulse h-40" />;
  if (!data) return null;

  const maxPlates = Math.max(...data.size_breakdown.map((s) => s.plates_issued), 1);

  return (
    <div className="bg-white border border-sand rounded-2xl p-5 mb-6 space-y-5">
      <div className="flex items-center gap-2">
        <span className="text-lg">🖨️</span>
        <h3 className="text-sm font-semibold text-charcoal">CTP Plates Outward Analytics</h3>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StatBox label="Entries Today" value={data.today.total_entries} />
        <StatBox label="Plates Today" value={data.today.total_plates.toLocaleString()} />
        <StatBox label="Entries (Month)" value={data.month.total_entries} />
        <StatBox label="Plates (Month)" value={data.month.total_plates.toLocaleString()} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-1">
        {/* Size breakdown */}
        <div>
          <p className="text-xs font-semibold text-taupe uppercase tracking-wide mb-2">Size Breakdown</p>
          {data.size_breakdown.length === 0 ? (
            <p className="text-xs text-taupe">No outward data yet.</p>
          ) : (
            <div className="space-y-1.5">
              {data.size_breakdown.map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="flex-1 bg-cream rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-rust h-1.5 rounded-full"
                      style={{ width: `${Math.min(100, (s.plates_issued / maxPlates) * 100)}%` }}
                    />
                  </div>
                  <span className="text-xs text-charcoal w-32 truncate">{s.plate_size}</span>
                  <span className="text-xs font-semibold text-charcoal w-16 text-right">
                    {s.plates_issued.toLocaleString()} plt
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top receivers */}
        <div>
          <p className="text-xs font-semibold text-taupe uppercase tracking-wide mb-2">Top Receivers</p>
          {data.top_receivers.length === 0 ? (
            <p className="text-xs text-taupe">No receiver data yet.</p>
          ) : (
            <ol className="space-y-1.5">
              {data.top_receivers.map((r, i) => (
                <li key={i} className="flex items-center gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-rust/10 text-rust text-xs font-bold flex items-center justify-center shrink-0">
                    {i + 1}
                  </span>
                  <span className="text-sm text-charcoal flex-1 truncate">{r.name}</span>
                  <span className="text-xs text-taupe">{r.total_plates.toLocaleString()} plates</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
