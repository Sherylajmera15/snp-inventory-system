"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { PackingOutwardAnalytics } from "@/types/packing-outward";

function StatBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-cream rounded-xl p-3">
      <p className="text-xs text-taupe mb-1 truncate">{label}</p>
      <p className="text-base font-bold text-charcoal">{value}</p>
    </div>
  );
}

function PeriodBlock({ data, label }: { data: PackingOutwardAnalytics["today"]; label: string }) {
  return (
    <div>
      <p className="text-xs font-semibold text-taupe uppercase tracking-wide mb-2">{label}</p>
      <div className="grid grid-cols-2 gap-2">
        <StatBox label="Entries" value={data.total_entries} />
        <StatBox label="Boxes Issued" value={data.boxes_issued.toLocaleString()} />
        <StatBox label="Plastic (Kg)" value={data.plastic_kg.toLocaleString()} />
        <StatBox label="Shrink Wrap (Kg)" value={data.shrink_wrap_kg.toLocaleString()} />
        <StatBox label="Sutli (Bundles)" value={data.sutli_bundles.toLocaleString()} />
      </div>
    </div>
  );
}

export default function PackingOutwardAnalyticsComponent() {
  const [data, setData] = useState<PackingOutwardAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/api/packing-outward/analytics").then((r) => setData(r.data)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="bg-white border border-sand rounded-2xl p-5 mb-6 animate-pulse h-40" />;
  if (!data) return null;

  return (
    <div className="bg-white border border-sand rounded-2xl p-5 mb-6 space-y-5">
      <div className="flex items-center gap-2">
        <span className="text-lg">📦</span>
        <h3 className="text-sm font-semibold text-charcoal">Packing Materials Outward Analytics</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <PeriodBlock data={data.today} label="Today" />
        <PeriodBlock data={data.month} label="This Month" />
      </div>
    </div>
  );
}
