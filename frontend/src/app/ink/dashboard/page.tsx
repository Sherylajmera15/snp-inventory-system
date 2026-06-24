"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import AppHeader from "@/components/AppHeader";
import api from "@/lib/api";
import { Search } from "lucide-react";

interface InkStockItem {
  item_type: string;
  category: string;
  color: string | null;
  pantone_number: string | null;
  varnish_type: string | null;
  available_kg: number;
}

function kgColor(qty: number) {
  if (qty <= 0) return "text-red-600 font-bold";
  if (qty < 5) return "text-amber-600 font-semibold";
  return "text-green-700 font-semibold";
}

export default function InkDashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [stock, setStock] = useState<InkStockItem[]>([]);
  const [fetching, setFetching] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  const fetchStock = useCallback(async () => {
    if (!user) return;
    try {
      const res = await api.get<InkStockItem[]>("/api/ink/stock");
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
    item.item_type.toLowerCase().includes(q) ||
    (item.color ?? "").toLowerCase().includes(q) ||
    (item.varnish_type ?? "").toLowerCase().includes(q) ||
    (item.category ?? "").toLowerCase().includes(q)
  );

  function displayColor(item: InkStockItem) {
    if (item.color) return item.color;
    if (item.varnish_type) return item.varnish_type;
    return "—";
  }

  return (
    <div className="min-h-screen bg-cream">
      <AppHeader title="Ink & Varnish Stock" backHref="/ink" />
      <main className="max-w-5xl mx-auto px-6 py-10 space-y-6">

        {/* Search */}
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-taupe pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by type, colour, varnish..."
            className="w-full rounded-xl border border-sand bg-white pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust"
          />
        </div>

        {fetching ? (
          <div className="bg-white border border-sand rounded-2xl h-40 animate-pulse" />
        ) : (
          <section>
            <h2 className="text-xs font-bold text-charcoal uppercase tracking-widest mb-4">
              Ink & Varnish Stock
            </h2>
            <div className="bg-white border border-sand rounded-2xl overflow-hidden">
              {filtered.length === 0 ? (
                <p className="text-sm text-taupe p-5">
                  {search ? "No items match your search." : "No ink or varnish stock data."}
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-cream text-taupe text-xs uppercase tracking-wide">
                      <th className="px-4 py-3 text-left font-medium">Type</th>
                      <th className="px-4 py-3 text-left font-medium">Category</th>
                      <th className="px-4 py-3 text-left font-medium">Colour / Varnish</th>
                      <th className="px-4 py-3 text-right font-medium">Available (kg)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((item, idx) => (
                      <tr key={idx} className="border-t border-sand">
                        <td className="px-4 py-3 text-charcoal font-medium">{item.item_type}</td>
                        <td className="px-4 py-3 text-charcoal">{item.category || "—"}</td>
                        <td className="px-4 py-3 text-charcoal">{displayColor(item)}</td>
                        <td className={`px-4 py-3 text-right ${kgColor(item.available_kg)}`}>
                          {item.available_kg <= 0 ? (
                            <span className="inline-block bg-red-100 text-red-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                              Out of Stock
                            </span>
                          ) : (
                            item.available_kg
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
