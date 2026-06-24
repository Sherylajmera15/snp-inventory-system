"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import AppHeader from "@/components/AppHeader";
import api from "@/lib/api";
import { Search } from "lucide-react";

interface CTPStockItem {
  plate_size: string;
  available_plates: number;
}

function plateColor(qty: number) {
  if (qty <= 0) return "text-red-600 font-bold";
  if (qty <= 100) return "text-amber-600 font-semibold";
  return "text-green-700 font-semibold";
}

export default function CTPDashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [stock, setStock] = useState<CTPStockItem[]>([]);
  const [fetching, setFetching] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  const fetchStock = useCallback(async () => {
    if (!user) return;
    try {
      const res = await api.get<CTPStockItem[]>("/api/ctp/stock");
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
  const filtered = stock.filter((item) =>
    item.plate_size.toLowerCase().includes(q)
  );

  return (
    <div className="min-h-screen bg-cream">
      <AppHeader title="CTP Plates Stock" backHref="/ctp" />
      <main className="max-w-3xl mx-auto px-6 py-10 space-y-6">

        {/* Search */}
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-taupe pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by plate size..."
            className="w-full rounded-xl border border-sand bg-white pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust"
          />
        </div>

        {fetching ? (
          <div className="bg-white border border-sand rounded-2xl h-40 animate-pulse" />
        ) : (
          <section>
            <h2 className="text-xs font-bold text-charcoal uppercase tracking-widest mb-4">
              Plate Stock
            </h2>
            <div className="bg-white border border-sand rounded-2xl overflow-hidden">
              {filtered.length === 0 ? (
                <p className="text-sm text-taupe p-5">
                  {search ? "No plates match your search." : "No plate stock data."}
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-cream text-taupe text-xs uppercase tracking-wide">
                      <th className="px-4 py-3 text-left font-medium">Plate Size</th>
                      <th className="px-4 py-3 text-right font-medium">Available Plates</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((item, idx) => (
                      <tr key={idx} className="border-t border-sand">
                        <td className="px-4 py-3 text-charcoal font-medium">{item.plate_size}</td>
                        <td className={`px-4 py-3 text-right ${plateColor(item.available_plates)}`}>
                          {item.available_plates <= 0 ? (
                            <span className="inline-block bg-red-100 text-red-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                              Out of Stock
                            </span>
                          ) : (
                            item.available_plates
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
