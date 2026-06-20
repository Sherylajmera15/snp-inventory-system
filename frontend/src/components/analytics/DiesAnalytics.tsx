"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";

interface DiesStats {
  today: { dies_added: number };
  month: { dies_added: number };
  active: number;
  discontinued: number;
  top_suppliers: { name: string; count: number }[];
}

function StatBox({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className={`rounded-xl p-3 ${accent ? "bg-rust/10" : "bg-cream"}`}>
      <p className="text-xs text-taupe mb-1 truncate">{label}</p>
      <p className={`text-base font-bold ${accent ? "text-rust" : "text-charcoal"}`}>{value}</p>
    </div>
  );
}

export default function DiesAnalytics() {
  const [data, setData] = useState<DiesStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/api/analytics/dies").then((r) => setData(r.data)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="bg-white border border-sand rounded-2xl p-5 mb-6 animate-pulse h-36" />;
  if (!data) return null;

  const total = data.active + data.discontinued;
  const activePct = total > 0 ? Math.round((data.active / total) * 100) : 0;

  return (
    <div className="bg-white border border-sand rounded-2xl p-5 mb-6 space-y-5">
      <div className="flex items-center gap-2">
        <span className="text-lg">✂️</span>
        <h3 className="text-sm font-semibold text-charcoal">Dies Analytics</h3>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StatBox label="Dies Added Today" value={data.today.dies_added} />
        <StatBox label="Dies Added (Month)" value={data.month.dies_added} />
        <StatBox label="Active Dies" value={data.active} accent />
        <StatBox label="Discontinued" value={data.discontinued} />
      </div>

      {total > 0 && (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-xs font-semibold text-taupe uppercase tracking-wide">Active / Discontinued Ratio</p>
            <p className="text-xs text-charcoal">{activePct}% Active</p>
          </div>
          <div className="w-full bg-cream rounded-full h-2 overflow-hidden">
            <div className="bg-green-500 h-2 rounded-full" style={{ width: `${activePct}%` }} />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-xs text-green-600">{data.active} Active</span>
            <span className="text-xs text-taupe">{data.discontinued} Discontinued</span>
          </div>
        </div>
      )}

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
                  <span className="text-xs text-taupe">{s.count} entries</span>
                </div>
              ))}
            </div>
          )
        }
      </div>
    </div>
  );
}
