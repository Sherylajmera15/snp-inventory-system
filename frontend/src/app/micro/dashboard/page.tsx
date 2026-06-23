"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import AppHeader from "@/components/AppHeader";
import api from "@/lib/api";
import { MicroDashboard } from "@/types/micro";

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number | string;
  color: "blue" | "green" | "purple" | "rust";
}) {
  const colorMap = {
    blue: "bg-blue-50 border-blue-100 text-blue-800",
    green: "bg-green-50 border-green-100 text-green-800",
    purple: "bg-purple-50 border-purple-100 text-purple-800",
    rust: "bg-rust/10 border-rust/20 text-rust",
  };
  const numColors = {
    blue: "text-blue-900",
    green: "text-green-900",
    purple: "text-purple-900",
    rust: "text-rust",
  };
  return (
    <div className={`rounded-2xl border p-5 ${colorMap[color]}`}>
      <p className="text-xs font-medium mb-1 opacity-75">{label}</p>
      <p className={`text-3xl font-bold ${numColors[color]}`}>{value}</p>
    </div>
  );
}

export default function MicroDashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<MicroDashboard | null>(null);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  const fetchDashboard = useCallback(async () => {
    if (!user) return;
    try {
      const res = await api.get<MicroDashboard>("/api/micro/dashboard");
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
      <AppHeader title="Micro Plates, Films & Chemicals" backHref="/dashboard" />
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-8">

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
                Today&apos;s Inward Activity
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <StatCard label="Plates Received" value={data.plates_today} color="blue" />
                <StatCard label="Chemicals Received" value={data.chemicals_today} color="green" />
                <StatCard label="Films Received" value={data.films_today} color="purple" />
              </div>
            </section>

            {/* This Month */}
            <section>
              <h2 className="text-xs font-bold text-charcoal uppercase tracking-widest mb-4">
                This Month
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <StatCard label="Plates (Month)" value={data.plates_month} color="blue" />
                <StatCard label="Chemicals (Month)" value={data.chemicals_month} color="green" />
                <StatCard label="Films (Month)" value={data.films_month} color="purple" />
              </div>
            </section>

            {/* Stock sections */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* Plate Stock */}
              <section>
                <h2 className="text-xs font-bold text-charcoal uppercase tracking-widest mb-4">Plate Stock</h2>
                <div className="bg-white border border-sand rounded-2xl overflow-hidden">
                  {data.plate_stock.length === 0 ? (
                    <p className="text-sm text-taupe p-5">No plate stock data.</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-cream text-taupe text-xs uppercase tracking-wide">
                          <th className="px-4 py-3 text-left font-medium">Plate Size</th>
                          <th className="px-4 py-3 text-right font-medium">Available</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.plate_stock.map((s) => (
                          <tr key={s.plate_size} className="border-t border-sand">
                            <td className="px-4 py-3 text-charcoal">{s.plate_size}</td>
                            <td className={`px-4 py-3 text-right font-bold ${s.available > 0 ? "text-blue-700" : "text-taupe"}`}>
                              {s.available}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </section>

              {/* Chemical Stock */}
              <section>
                <h2 className="text-xs font-bold text-charcoal uppercase tracking-widest mb-4">Chemical Stock</h2>
                <div className="bg-white border border-sand rounded-2xl overflow-hidden">
                  {data.chemical_stock.length === 0 ? (
                    <p className="text-sm text-taupe p-5">No chemical stock data.</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-cream text-taupe text-xs uppercase tracking-wide">
                          <th className="px-4 py-3 text-left font-medium">Chemical</th>
                          <th className="px-4 py-3 text-right font-medium">Available</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.chemical_stock.map((s) => (
                          <tr key={s.item_name} className="border-t border-sand">
                            <td className="px-4 py-3 text-charcoal">
                              <p className="font-medium truncate max-w-32">{s.item_name}</p>
                              <p className="text-xs text-taupe">{s.unit}</p>
                            </td>
                            <td className={`px-4 py-3 text-right font-bold ${s.available_qty > 0 ? "text-green-700" : "text-taupe"}`}>
                              {s.available_qty}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </section>

              {/* Film Stock */}
              <section>
                <h2 className="text-xs font-bold text-charcoal uppercase tracking-widest mb-4">Film Stock</h2>
                <div className="bg-white border border-sand rounded-2xl overflow-hidden">
                  {data.film_stock.length === 0 ? (
                    <p className="text-sm text-taupe p-5">No film stock data.</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-cream text-taupe text-xs uppercase tracking-wide">
                          <th className="px-4 py-3 text-left font-medium">Film</th>
                          <th className="px-4 py-3 text-right font-medium">Available</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.film_stock.map((s, idx) => {
                          const dims = (s.film_length || s.film_width)
                            ? `${s.film_length ?? "?"} × ${s.film_width ?? "?"} mm`
                            : "No size";
                          return (
                            <tr key={idx} className="border-t border-sand">
                              <td className="px-4 py-3 text-charcoal">
                                <p className="font-medium">{dims}</p>
                                <p className="text-xs text-purple-600">{s.film_type}</p>
                              </td>
                              <td className={`px-4 py-3 text-right font-bold ${s.available > 0 ? "text-purple-700" : "text-taupe"}`}>
                                {s.available}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </section>
            </div>

            {/* Top Suppliers */}
            {data.top_suppliers.length > 0 && (
              <section>
                <h2 className="text-xs font-bold text-charcoal uppercase tracking-widest mb-4">Top Suppliers</h2>
                <div className="bg-white border border-sand rounded-2xl p-5">
                  <ol className="space-y-2">
                    {data.top_suppliers.map((s, i) => (
                      <li key={s.name} className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-rust/10 text-rust text-xs font-bold flex items-center justify-center shrink-0">
                          {i + 1}
                        </span>
                        <span className="text-sm text-charcoal flex-1 truncate">{s.name}</span>
                        <span className="text-xs text-taupe">{s.count} entries</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
