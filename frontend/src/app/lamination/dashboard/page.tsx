"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import AppHeader from "@/components/AppHeader";
import api from "@/lib/api";
import { LaminationDashboard, LaminationStockItem } from "@/types/lamination";

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number | string;
  color: "blue" | "green" | "rust" | "amber";
}) {
  const colorMap = {
    blue: "bg-blue-50 border-blue-100 text-blue-800",
    green: "bg-green-50 border-green-100 text-green-800",
    rust: "bg-rust/10 border-rust/20 text-rust",
    amber: "bg-amber-50 border-amber-100 text-amber-800",
  };
  const numColors = {
    blue: "text-blue-900",
    green: "text-green-900",
    rust: "text-rust",
    amber: "text-amber-900",
  };
  return (
    <div className={`rounded-2xl border p-5 ${colorMap[color]}`}>
      <p className="text-xs font-medium mb-1 opacity-75">{label}</p>
      <p className={`text-3xl font-bold ${numColors[color]}`}>{value}</p>
    </div>
  );
}

function filmTypeBadgeClass(film_type: string) {
  switch (film_type) {
    case "PVC": return "bg-blue-100 text-blue-700";
    case "BOPP": return "bg-green-100 text-green-700";
    case "SILVER": return "bg-gray-100 text-gray-600";
    case "HOLOGRAPHIC": return "bg-purple-100 text-purple-700";
    default: return "bg-amber-100 text-amber-700";
  }
}

function stockLabel(item: LaminationStockItem) {
  const type = item.film_type === "OTHER" && item.custom_type ? item.custom_type : item.film_type;
  return type;
}

export default function LaminationDashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<LaminationDashboard | null>(null);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  const fetchDashboard = useCallback(async () => {
    if (!user) return;
    try {
      const res = await api.get<LaminationDashboard>("/api/lamination/dashboard");
      setData(res.data);
    } catch {
      // ignore
    } finally {
      setFetching(false);
    }
  }, [user]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream">
        <p className="text-taupe">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream">
      <AppHeader title="Lamination Film Dashboard" backHref="/lamination" />
      <main className="max-w-5xl mx-auto px-6 py-10 space-y-8">

        {/* Quick links */}
        <div className="flex items-center gap-3">
          <Link
            href="/lamination"
            className="inline-flex items-center gap-1.5 text-xs border border-sand bg-white text-charcoal rounded-xl px-3 py-2 hover:border-rust hover:text-rust transition-colors"
          >
            Inward Entries
          </Link>
          <Link
            href="/lamination-outward"
            className="inline-flex items-center gap-1.5 text-xs border border-sand bg-white text-charcoal rounded-xl px-3 py-2 hover:border-rust hover:text-rust transition-colors"
          >
            Outward Entries
          </Link>
        </div>

        {fetching ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-white border border-sand rounded-2xl h-28 animate-pulse" />
            ))}
          </div>
        ) : !data ? (
          <div className="bg-white border border-sand rounded-2xl p-12 text-center">
            <p className="text-taupe">Unable to load dashboard data.</p>
          </div>
        ) : (
          <>
            {/* Today */}
            <section>
              <h2 className="text-xs font-bold text-charcoal uppercase tracking-widest mb-4">
                Today&apos;s Activity
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <StatCard label="Entries Today" value={data.entries_today} color="blue" />
                <StatCard label="Weight Received (kg)" value={data.weight_received_today.toFixed(2)} color="green" />
                <StatCard label="Weight Issued (kg)" value={data.weight_issued_today.toFixed(2)} color="rust" />
              </div>
            </section>

            {/* This Month */}
            <section>
              <h2 className="text-xs font-bold text-charcoal uppercase tracking-widest mb-4">
                This Month
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <StatCard label="Entries This Month" value={data.entries_month} color="blue" />
                <StatCard label="Weight Received (kg)" value={data.weight_received_month.toFixed(2)} color="green" />
                <StatCard label="Weight Issued (kg)" value={data.weight_issued_month.toFixed(2)} color="rust" />
              </div>
            </section>

            {/* Current Stock */}
            <section>
              <h2 className="text-xs font-bold text-charcoal uppercase tracking-widest mb-4">
                Current Stock
              </h2>
              <div className="bg-white border border-sand rounded-2xl overflow-hidden">
                {data.stock_by_type.length === 0 ? (
                  <p className="text-sm text-taupe p-5">No stock data available.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-cream text-taupe text-xs uppercase tracking-wide">
                        <th className="px-5 py-3 text-left font-medium">Film Type</th>
                        <th className="px-5 py-3 text-left font-medium">Roll Size</th>
                        <th className="px-5 py-3 text-right font-medium">Rolls</th>
                        <th className="px-5 py-3 text-right font-medium">Remaining Wt (kg)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.stock_by_type.map((item, idx) => (
                        <tr key={idx} className="border-t border-sand hover:bg-cream/40 transition-colors">
                          <td className="px-5 py-3">
                            <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full ${filmTypeBadgeClass(item.film_type)}`}>
                              {stockLabel(item)}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-charcoal">{item.roll_size || "—"}</td>
                          <td className={`px-5 py-3 text-right font-bold ${item.roll_count > 0 ? "text-charcoal" : "text-taupe"}`}>
                            {item.roll_count}
                          </td>
                          <td className={`px-5 py-3 text-right font-bold ${item.total_weight > 0 ? "text-rust" : "text-taupe"}`}>
                            {item.total_weight.toFixed(3)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
