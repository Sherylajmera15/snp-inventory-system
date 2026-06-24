"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import AppHeader from "@/components/AppHeader";
import api from "@/lib/api";
import { Search } from "lucide-react";

interface ReelStock {
  quality: string;
  gsm: number;
  reel_width: number;
  available_kg: number;
}

interface SheetStock {
  quality: string;
  gsm: number;
  sheet_length: number;
  sheet_width: number;
  available_sheets: number;
}

interface PaperStock {
  reels: ReelStock[];
  sheets: SheetStock[];
}

function kgColor(qty: number) {
  if (qty <= 0) return "text-red-600 font-bold";
  if (qty < 5) return "text-amber-600 font-semibold";
  return "text-green-700 font-semibold";
}

function countColor(qty: number) {
  if (qty <= 0) return "text-red-600 font-bold";
  if (qty < 50) return "text-amber-600 font-semibold";
  return "text-green-700 font-semibold";
}

export default function PaperDashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [stock, setStock] = useState<PaperStock | null>(null);
  const [fetching, setFetching] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  const fetchStock = useCallback(async () => {
    if (!user) return;
    try {
      const res = await api.get<PaperStock>("/api/paper/stock");
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
  const filteredReels = stock?.reels.filter(
    (r) =>
      r.quality.toLowerCase().includes(q) ||
      String(r.gsm).includes(q) ||
      String(r.reel_width).includes(q)
  ) ?? [];
  const filteredSheets = stock?.sheets.filter(
    (s) =>
      s.quality.toLowerCase().includes(q) ||
      String(s.gsm).includes(q)
  ) ?? [];

  return (
    <div className="min-h-screen bg-cream">
      <AppHeader title="Paper Stock Dashboard" backHref="/paper" />
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-6">

        {/* Search */}
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-taupe pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by quality, GSM..."
            className="w-full rounded-xl border border-sand bg-white pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust"
          />
        </div>

        {fetching ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white border border-sand rounded-2xl h-40 animate-pulse" />
            <div className="bg-white border border-sand rounded-2xl h-40 animate-pulse" />
          </div>
        ) : !stock ? (
          <div className="bg-white border border-sand rounded-2xl p-12 text-center">
            <p className="text-taupe">Unable to load stock data.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Reel Stock */}
            <section>
              <h2 className="text-xs font-bold text-charcoal uppercase tracking-widest mb-4">
                Reel Stock (kg)
              </h2>
              <div className="bg-white border border-sand rounded-2xl overflow-hidden">
                {filteredReels.length === 0 ? (
                  <p className="text-sm text-taupe p-5">No reel stock found.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-cream text-taupe text-xs uppercase tracking-wide">
                        <th className="px-4 py-3 text-left font-medium">Quality</th>
                        <th className="px-4 py-3 text-left font-medium">GSM</th>
                        <th className="px-4 py-3 text-left font-medium">Width</th>
                        <th className="px-4 py-3 text-right font-medium">Available (kg)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredReels.map((r, idx) => (
                        <tr key={idx} className="border-t border-sand">
                          <td className="px-4 py-3 text-charcoal font-medium">{r.quality}</td>
                          <td className="px-4 py-3 text-charcoal">{r.gsm}</td>
                          <td className="px-4 py-3 text-charcoal">{r.reel_width}</td>
                          <td className={`px-4 py-3 text-right ${kgColor(r.available_kg)}`}>
                            {r.available_kg <= 0 ? (
                              <span className="inline-block bg-red-100 text-red-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                                Out of Stock
                              </span>
                            ) : (
                              r.available_kg
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </section>

            {/* Sheet Stock */}
            <section>
              <h2 className="text-xs font-bold text-charcoal uppercase tracking-widest mb-4">
                Sheet Stock
              </h2>
              <div className="bg-white border border-sand rounded-2xl overflow-hidden">
                {filteredSheets.length === 0 ? (
                  <p className="text-sm text-taupe p-5">No sheet stock found.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-cream text-taupe text-xs uppercase tracking-wide">
                        <th className="px-4 py-3 text-left font-medium">Quality</th>
                        <th className="px-4 py-3 text-left font-medium">GSM</th>
                        <th className="px-4 py-3 text-left font-medium">Sheet Size (L×W)</th>
                        <th className="px-4 py-3 text-right font-medium">Available (sheets)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredSheets.map((s, idx) => (
                        <tr key={idx} className="border-t border-sand">
                          <td className="px-4 py-3 text-charcoal font-medium">{s.quality}</td>
                          <td className="px-4 py-3 text-charcoal">{s.gsm}</td>
                          <td className="px-4 py-3 text-charcoal">{s.sheet_length} × {s.sheet_width}</td>
                          <td className={`px-4 py-3 text-right ${countColor(s.available_sheets)}`}>
                            {s.available_sheets <= 0 ? (
                              <span className="inline-block bg-red-100 text-red-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                                Out of Stock
                              </span>
                            ) : (
                              s.available_sheets
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </section>

          </div>
        )}
      </main>
    </div>
  );
}
