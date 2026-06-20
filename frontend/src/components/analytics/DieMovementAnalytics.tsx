"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { DieMovementAnalytics } from "@/types/die-movement";

function StatBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-cream rounded-xl p-3">
      <p className="text-xs text-taupe mb-1 truncate">{label}</p>
      <p className="text-base font-bold text-charcoal">{value}</p>
    </div>
  );
}

export default function DieMovementAnalyticsComponent() {
  const [data, setData] = useState<DieMovementAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/api/die-movement/analytics").then((r) => setData(r.data)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="bg-white border border-sand rounded-2xl p-5 mb-6 animate-pulse h-40" />;
  if (!data) return null;

  const maxLoc = Math.max(...data.location_summary.map((x) => x.die_count), 1);

  return (
    <div className="bg-white border border-sand rounded-2xl p-5 mb-6 space-y-5">
      <div className="flex items-center gap-2">
        <span className="text-lg">✂️</span>
        <h3 className="text-sm font-semibold text-charcoal">Die Movement Analytics</h3>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StatBox label="Movements Today" value={data.today_movements} />
        <StatBox label="Movements (Month)" value={data.month_movements} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-1">
        <div>
          <p className="text-xs font-semibold text-taupe uppercase tracking-wide mb-2">Most Frequently Moved</p>
          {data.top_moved_dies.length === 0
            ? <p className="text-xs text-taupe">No movement data yet.</p>
            : (
              <ol className="space-y-1.5">
                {data.top_moved_dies.slice(0, 8).map((d, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-rust/10 text-rust text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                    <span className="text-xs font-medium text-charcoal flex-1 truncate">{d.die_number}</span>
                    <span className="text-xs text-taupe truncate hidden sm:block max-w-[120px]">{d.job_name}</span>
                    <span className="text-xs text-taupe whitespace-nowrap">{d.movement_count}×</span>
                  </li>
                ))}
              </ol>
            )}
        </div>

        <div>
          <p className="text-xs font-semibold text-taupe uppercase tracking-wide mb-2">Current Location Summary</p>
          {data.location_summary.length === 0
            ? <p className="text-xs text-taupe">No location data yet.</p>
            : (
              <div className="space-y-1.5">
                {data.location_summary.map((loc, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="flex-1 bg-cream rounded-full h-1.5 overflow-hidden">
                      <div className="bg-rust h-1.5 rounded-full" style={{ width: `${Math.min(100, (loc.die_count / maxLoc) * 100)}%` }} />
                    </div>
                    <span className="text-xs text-charcoal w-32 truncate">{loc.location}</span>
                    <span className="text-xs font-semibold text-charcoal w-12 text-right">{loc.die_count} dies</span>
                  </div>
                ))}
              </div>
            )}
        </div>
      </div>
    </div>
  );
}
