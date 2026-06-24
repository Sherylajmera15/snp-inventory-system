"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import AppHeader from "@/components/AppHeader";
import api from "@/lib/api";
import { Search } from "lucide-react";

interface ConsumableStockItem {
  item_name: string;
  unit: string;
  available_qty: number;
}

function qtyColor(qty: number) {
  if (qty <= 0) return "text-red-600 font-bold";
  if (qty < 5) return "text-amber-600 font-semibold";
  return "text-green-700 font-semibold";
}

export default function ConsumablesDashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [stock, setStock] = useState<ConsumableStockItem[]>([]);
  const [fetching, setFetching] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  const fetchStock = useCallback(async () => {
    if (!user) return;
    try {
      const res = await api.get<ConsumableStockItem[]>("/api/consumables/stock");
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
    item.item_name.toLowerCase().includes(q)
  );

  return (
    <div className="min-h-screen bg-cream">
      <AppHeader title="Consumables Stock" backHref="/consumables" />
      <main className="max-w-4xl mx-auto px-6 py-10 space-y-6">

        {/* Search */}
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-taupe pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by item name..."
            className="w-full rounded-xl border border-sand bg-white pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust"
          />
        </div>

        {fetching ? (
          <div className="bg-white border border-sand rounded-2xl h-40 animate-pulse" />
        ) : (
          <section>
            <h2 className="text-xs font-bold text-charcoal uppercase tracking-widest mb-4">
              Consumables Stock
            </h2>
            <div className="bg-white border border-sand rounded-2xl overflow-hidden">
              {filtered.length === 0 ? (
                <p className="text-sm text-taupe p-5">
                  {search ? "No consumables match your search." : "No consumable stock data."}
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-cream text-taupe text-xs uppercase tracking-wide">
                      <th className="px-4 py-3 text-left font-medium">Item Name</th>
                      <th className="px-4 py-3 text-right font-medium">Available Qty</th>
                      <th className="px-4 py-3 text-left font-medium">Unit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((item, idx) => (
                      <tr key={idx} className="border-t border-sand">
                        <td className="px-4 py-3 text-charcoal font-medium">{item.item_name}</td>
                        <td className={`px-4 py-3 text-right ${qtyColor(item.available_qty)}`}>
                          {item.available_qty <= 0 ? (
                            <span className="inline-block bg-red-100 text-red-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                              Out of Stock
                            </span>
                          ) : (
                            item.available_qty
                          )}
                        </td>
                        <td className="px-4 py-3 text-taupe">{item.unit}</td>
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
