"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import AppHeader from "@/components/AppHeader";
import api from "@/lib/api";
import { Search } from "lucide-react";

interface DieStockItem {
  die_number: string;
  job_name: string;
  status: string;
  current_location: string;
}

interface DiesStock {
  active_count: number;
  discontinued_count: number;
  items: DieStockItem[];
}

function statusBadge(status: string) {
  if (status === "Active") {
    return (
      <span className="inline-block bg-green-100 text-green-700 text-xs font-semibold px-2 py-0.5 rounded-full">
        Active
      </span>
    );
  }
  return (
    <span className="inline-block bg-gray-100 text-gray-600 text-xs font-semibold px-2 py-0.5 rounded-full">
      {status}
    </span>
  );
}

export default function DiesDashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [stock, setStock] = useState<DiesStock | null>(null);
  const [fetching, setFetching] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  const fetchStock = useCallback(async () => {
    if (!user) return;
    try {
      const res = await api.get<DiesStock>("/api/dies/stock");
      setStock(res.data);
    } catch {
      // ignore
    } finally {
      setFetching(false);
    }
  }, [user]);

  useEffect(() => {
    fetchStock();
  }, [fetchStock]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream">
        <p className="text-taupe">Loading...</p>
      </div>
    );
  }

  const q = search.toLowerCase();
  const filtered = stock?.items.filter(
    (item) =>
      item.die_number.toLowerCase().includes(q) ||
      item.job_name.toLowerCase().includes(q) ||
      (item.current_location ?? "").toLowerCase().includes(q)
  ) ?? [];

  return (
    <div className="min-h-screen bg-cream">
      <AppHeader title="Dies Inventory" backHref="/dies" />
      <main className="max-w-5xl mx-auto px-6 py-10 space-y-6">

        {fetching ? (
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white border border-sand rounded-2xl h-28 animate-pulse" />
            <div className="bg-white border border-sand rounded-2xl h-28 animate-pulse" />
          </div>
        ) : stock ? (
          <>
            {/* Stat Cards */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-green-50 border border-green-100 rounded-2xl p-5">
                <p className="text-xs font-medium text-green-700 mb-1 opacity-75">Active Dies</p>
                <p className="text-3xl font-bold text-green-900">{stock.active_count}</p>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5">
                <p className="text-xs font-medium text-gray-600 mb-1 opacity-75">Discontinued</p>
                <p className="text-3xl font-bold text-gray-700">{stock.discontinued_count}</p>
              </div>
            </div>

            {/* Search */}
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-taupe pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by die number, job name, location..."
                className="w-full rounded-xl border border-sand bg-white pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust"
              />
            </div>

            {/* Table */}
            <section>
              <h2 className="text-xs font-bold text-charcoal uppercase tracking-widest mb-4">
                All Dies
              </h2>
              <div className="bg-white border border-sand rounded-2xl overflow-hidden">
                {filtered.length === 0 ? (
                  <p className="text-sm text-taupe p-5">
                    {search ? "No dies match your search." : "No dies data."}
                  </p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-cream text-taupe text-xs uppercase tracking-wide">
                        <th className="px-4 py-3 text-left font-medium">Die Number</th>
                        <th className="px-4 py-3 text-left font-medium">Job Name</th>
                        <th className="px-4 py-3 text-left font-medium">Status</th>
                        <th className="px-4 py-3 text-left font-medium">Location</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((item, idx) => (
                        <tr key={idx} className="border-t border-sand">
                          <td className="px-4 py-3 text-charcoal font-medium">{item.die_number}</td>
                          <td className="px-4 py-3 text-charcoal">{item.job_name || "—"}</td>
                          <td className="px-4 py-3">{statusBadge(item.status)}</td>
                          <td className="px-4 py-3 text-charcoal">{item.current_location || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </section>
          </>
        ) : (
          <div className="bg-white border border-sand rounded-2xl p-12 text-center">
            <p className="text-taupe">Unable to load dies inventory data.</p>
          </div>
        )}
      </main>
    </div>
  );
}
