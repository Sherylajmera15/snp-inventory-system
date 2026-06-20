"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";

interface PaperStats {
  today: { entries: number; reel: number; sheet: number; reel_weight: number; sheets: number; job_work: number; self_work: number };
  month: { entries: number; reel_weight: number; sheets: number };
  quality_breakdown: { quality: string; entries: number; reel_weight: number; sheets: number }[];
  top_suppliers: { name: string; count: number }[];
}

function StatBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-cream rounded-xl p-3 min-w-0">
      <p className="text-xs text-taupe mb-1 truncate">{label}</p>
      <p className="text-base font-bold text-charcoal">{value}</p>
    </div>
  );
}

export default function PaperAnalytics() {
  const [data, setData] = useState<PaperStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/api/analytics/paper")
      .then((r) => setData(r.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="bg-white border border-sand rounded-2xl p-5 mb-6 animate-pulse h-40" />;
  if (!data) return null;

  const t = data.today;
  const m = data.month;

  return (
    <div className="bg-white border border-sand rounded-2xl p-5 mb-6 space-y-5">
      <div className="flex items-center gap-2">
        <span className="text-lg">📄</span>
        <h3 className="text-sm font-semibold text-charcoal">Paper Analytics</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Today */}
        <div>
          <p className="text-xs font-semibold text-taupe uppercase tracking-wide mb-2">Today</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <StatBox label="Entries" value={t.entries} />
            <StatBox label="Reel Items" value={t.reel} />
            <StatBox label="Sheet Items" value={t.sheet} />
            <StatBox label="Reel Weight (kg)" value={t.reel_weight.toFixed(1)} />
            <StatBox label="Total Sheets" value={t.sheets.toLocaleString()} />
            <StatBox label="Job Work" value={t.job_work} />
            <StatBox label="Self Work" value={t.self_work} />
          </div>
        </div>
        {/* This Month */}
        <div>
          <p className="text-xs font-semibold text-taupe uppercase tracking-wide mb-2">This Month</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <StatBox label="Total Entries" value={m.entries} />
            <StatBox label="Reel Weight (kg)" value={m.reel_weight.toFixed(1)} />
            <StatBox label="Total Sheets" value={m.sheets.toLocaleString()} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-1">
        {/* Quality Breakdown */}
        <div>
          <p className="text-xs font-semibold text-taupe uppercase tracking-wide mb-2">Quality Breakdown</p>
          {data.quality_breakdown.length === 0
            ? <p className="text-xs text-taupe">No data yet.</p>
            : (
              <div className="space-y-1.5">
                {data.quality_breakdown.slice(0, 8).map((q, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="flex-1 bg-cream rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-rust h-1.5 rounded-full"
                        style={{ width: `${Math.min(100, (q.entries / (data.quality_breakdown[0]?.entries || 1)) * 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-charcoal w-28 truncate">{q.quality}</span>
                    <span className="text-xs font-semibold text-charcoal w-8 text-right">{q.entries}</span>
                  </div>
                ))}
              </div>
            )
          }
        </div>
        {/* Top Suppliers */}
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
