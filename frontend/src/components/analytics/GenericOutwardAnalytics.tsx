"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { GenericOutwardAnalytics } from "@/types/generic-outward";

function StatBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-cream rounded-xl p-3">
      <p className="text-xs text-taupe mb-1 truncate">{label}</p>
      <p className="text-base font-bold text-charcoal">{value}</p>
    </div>
  );
}

export default function GenericOutwardAnalyticsComponent({
  apiPrefix,
  emoji,
  title,
}: {
  apiPrefix: string;
  emoji: string;
  title: string;
}) {
  const [data, setData] = useState<GenericOutwardAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`${apiPrefix}/analytics`)
      .then((r) => setData(r.data))
      .finally(() => setLoading(false));
  }, [apiPrefix]);

  if (loading) return <div className="bg-white border border-sand rounded-2xl p-5 mb-6 animate-pulse h-40" />;
  if (!data) return null;

  const maxTop = Math.max(...data.top_consumed.map((x) => x.total_qty), 1);

  return (
    <div className="bg-white border border-sand rounded-2xl p-5 mb-6 space-y-5">
      <div className="flex items-center gap-2">
        <span className="text-lg">{emoji}</span>
        <h3 className="text-sm font-semibold text-charcoal">{title} Outward Analytics</h3>
      </div>

      {/* Stat boxes */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StatBox label="Entries Today" value={data.today.total_entries} />
        <StatBox label="Items Issued Today" value={data.today.total_items} />
        <StatBox label="Entries (Month)" value={data.month.total_entries} />
        <StatBox label="Items Issued (Month)" value={data.month.total_items} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-1">
        {/* Top consumed today */}
        <div>
          <p className="text-xs font-semibold text-taupe uppercase tracking-wide mb-2">Top Consumed Today</p>
          {data.today.top_consumed.length === 0
            ? <p className="text-xs text-taupe">No outward data today.</p>
            : (
              <ol className="space-y-1.5">
                {data.today.top_consumed.map((item, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-rust/10 text-rust text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                    <span className="text-xs text-charcoal flex-1 truncate">{item.item_name}</span>
                    <span className="text-xs text-taupe whitespace-nowrap">{item.total_qty} {item.unit}</span>
                  </li>
                ))}
              </ol>
            )}
        </div>

        {/* Top consumed this month */}
        <div>
          <p className="text-xs font-semibold text-taupe uppercase tracking-wide mb-2">Top Consumed (Month)</p>
          {data.month.top_consumed.length === 0
            ? <p className="text-xs text-taupe">No outward data this month.</p>
            : (
              <ol className="space-y-1.5">
                {data.month.top_consumed.map((item, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-rust/10 text-rust text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                    <span className="text-xs text-charcoal flex-1 truncate">{item.item_name}</span>
                    <span className="text-xs text-taupe whitespace-nowrap">{item.total_qty} {item.unit}</span>
                  </li>
                ))}
              </ol>
            )}
        </div>

        {/* Top consumed all time + top receivers */}
        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold text-taupe uppercase tracking-wide mb-2">All-Time Top Consumed</p>
            {data.top_consumed.length === 0
              ? <p className="text-xs text-taupe">No data yet.</p>
              : (
                <div className="space-y-1.5">
                  {data.top_consumed.slice(0, 5).map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="flex-1 bg-cream rounded-full h-1.5 overflow-hidden">
                        <div className="bg-rust h-1.5 rounded-full" style={{ width: `${Math.min(100, (item.total_qty / maxTop) * 100)}%` }} />
                      </div>
                      <span className="text-xs text-charcoal w-28 truncate">{item.item_name}</span>
                      <span className="text-xs font-semibold text-charcoal w-20 text-right whitespace-nowrap">{item.total_qty} {item.unit}</span>
                    </div>
                  ))}
                </div>
              )}
          </div>

          <div>
            <p className="text-xs font-semibold text-taupe uppercase tracking-wide mb-2">Top Receivers</p>
            {data.top_receivers.length === 0
              ? <p className="text-xs text-taupe">No data yet.</p>
              : (
                <ol className="space-y-1.5">
                  {data.top_receivers.slice(0, 5).map((r, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-rust/10 text-rust text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                      <span className="text-xs text-charcoal flex-1 truncate">{r.received_by}</span>
                      <span className="text-xs text-taupe whitespace-nowrap">{r.entry_count} entries</span>
                    </li>
                  ))}
                </ol>
              )}
          </div>
        </div>
      </div>
    </div>
  );
}
