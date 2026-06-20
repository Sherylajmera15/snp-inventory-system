"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { OutwardAnalytics } from "@/types/paper-outward";

function num(n: number) { return n?.toLocaleString() ?? "0"; }

export default function PaperOutwardAnalytics() {
  const [data, setData] = useState<OutwardAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/api/paper-outward/analytics")
      .then((r) => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white border border-sand rounded-2xl h-20 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-4 mb-8">
      {/* Today + Month stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Today */}
        <div className="bg-white border border-sand rounded-2xl p-4">
          <p className="text-xs font-semibold text-taupe uppercase tracking-widest mb-3">Today</p>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-cream rounded-xl px-3 py-2.5">
              <p className="text-xs text-taupe">Entries</p>
              <p className="text-xl font-bold text-charcoal">{num(data.today.total_entries)}</p>
            </div>
            <div className="bg-cream rounded-xl px-3 py-2.5">
              <p className="text-xs text-taupe">Reel Wt. (Kg)</p>
              <p className="text-xl font-bold text-charcoal">{num(data.today.total_reel_weight_kg)}</p>
            </div>
            <div className="bg-cream rounded-xl px-3 py-2.5">
              <p className="text-xs text-taupe">Sheets</p>
              <p className="text-xl font-bold text-charcoal">{num(data.today.total_sheets)}</p>
            </div>
          </div>
        </div>

        {/* This Month */}
        <div className="bg-white border border-sand rounded-2xl p-4">
          <p className="text-xs font-semibold text-taupe uppercase tracking-widest mb-3">This Month</p>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-cream rounded-xl px-3 py-2.5">
              <p className="text-xs text-taupe">Entries</p>
              <p className="text-xl font-bold text-charcoal">{num(data.month.total_entries)}</p>
            </div>
            <div className="bg-cream rounded-xl px-3 py-2.5">
              <p className="text-xs text-taupe">Reel Wt. (Kg)</p>
              <p className="text-xl font-bold text-charcoal">{num(data.month.total_reel_weight_kg)}</p>
            </div>
            <div className="bg-cream rounded-xl px-3 py-2.5">
              <p className="text-xs text-taupe">Sheets</p>
              <p className="text-xl font-bold text-charcoal">{num(data.month.total_sheets)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Top consumed qualities + Top jobs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Top consumed qualities */}
        <div className="bg-white border border-sand rounded-2xl p-4">
          <p className="text-xs font-semibold text-taupe uppercase tracking-widest mb-3">Top Consumed Paper</p>
          {data.top_consumed_qualities.length === 0 ? (
            <p className="text-xs text-taupe">No outward data yet.</p>
          ) : (
            <div className="space-y-2">
              {data.top_consumed_qualities.map((q, i) => (
                <div key={i} className="flex items-center justify-between py-1.5 border-b border-sand/50 last:border-0">
                  <div>
                    <span className="text-sm font-medium text-charcoal">{q.quality}</span>
                    <span className="text-xs text-taupe ml-1.5">{q.gsm} GSM · {q.form_type.replace(" Form", "")}</span>
                  </div>
                  <span className="text-sm font-bold text-rust">
                    {q.form_type === "Reel Form"
                      ? `${num(q.total_weight_kg)} Kg`
                      : `${num(q.total_sheets)} Sheets`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top jobs */}
        <div className="bg-white border border-sand rounded-2xl p-4">
          <p className="text-xs font-semibold text-taupe uppercase tracking-widest mb-3">Top Jobs by Consumption</p>
          {data.top_jobs.length === 0 ? (
            <p className="text-xs text-taupe">No outward data yet.</p>
          ) : (
            <div className="space-y-2">
              {data.top_jobs.map((j, i) => (
                <div key={i} className="flex items-center justify-between py-1.5 border-b border-sand/50 last:border-0">
                  <span className="text-sm font-medium text-charcoal truncate max-w-[60%]">{j.job_name}</span>
                  <div className="text-right text-xs text-taupe shrink-0">
                    {j.total_weight_kg > 0 && <div className="font-medium text-charcoal">{num(j.total_weight_kg)} Kg</div>}
                    {j.total_sheets > 0 && <div>{num(j.total_sheets)} Sheets</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
