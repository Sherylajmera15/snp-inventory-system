"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import AppHeader from "@/components/AppHeader";
import InkOutwardAnalyticsComponent from "@/components/analytics/InkOutwardAnalytics";
import api from "@/lib/api";
import { InkOutwardListItem } from "@/types/ink-outward";
import { Download, Plus, Search } from "lucide-react";
import { exportInkOutward } from "@/lib/exportUtils";
import ExportModal from "@/components/ExportModal";

export default function InkOutwardDashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [entries, setEntries] = useState<InkOutwardListItem[]>([]);
  const [fetching, setFetching] = useState(true);
  const [exportOpen, setExportOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  const fetchEntries = useCallback(async () => {
    setFetching(true);
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      const res = await api.get("/api/ink-outward", { params });
      setEntries(res.data);
    } finally {
      setFetching(false);
    }
  }, [search, dateFrom, dateTo]);

  useEffect(() => {
    if (!user) return;
    const t = setTimeout(fetchEntries, 300);
    return () => clearTimeout(t);
  }, [user, fetchEntries]);

  const handleExport = async (format: "pdf" | "excel", df: string, dt: string, rangeLabel: string) => {
    const params: Record<string, string> = {};
    if (df) params.date_from = df;
    if (dt) params.date_to = dt;
    const res = await api.get("/api/ink-outward/export", { params });
    exportInkOutward(res.data, format, rangeLabel);
  };

  if (loading || !user) {
    return <div className="min-h-screen flex items-center justify-center bg-cream"><p className="text-taupe">Loading...</p></div>;
  }

  return (
    <div className="min-h-screen bg-cream">
      <AppHeader title="Ink & Varnishes Outward" backHref="/outward" />

      <main className="max-w-6xl mx-auto px-6 py-10 space-y-6">

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-charcoal">🎨 Ink & Varnishes Outward Dashboard</h1>
            <p className="text-sm text-taupe mt-0.5">Inks and varnishes issued for production</p>
          </div>
          <Link href="/ink-outward/new"
            className="inline-flex items-center gap-2 bg-rust text-white rounded-xl px-5 py-2.5 text-sm font-semibold hover:bg-rust/90 transition-colors">
            <Plus size={16} />Create New Outward Entry
          </Link>
        </div>

        <InkOutwardAnalyticsComponent />

        {/* Filters */}
        <div className="bg-white border border-sand rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-taupe pointer-events-none" />
            <input type="text" placeholder="Search by job, color, varnish, issued by…"
              value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-sand bg-cream/40 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust" />
          </div>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            className="w-full rounded-lg border border-sand bg-cream/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust" title="From date" />
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            className="w-full rounded-lg border border-sand bg-cream/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust" title="To date" />
        </div>

        <div className="flex items-center justify-between">
          <p className="text-sm text-taupe">
            {fetching ? "Loading…" : `${entries.length} entr${entries.length === 1 ? "y" : "ies"}`}
          </p>
          <button onClick={() => setExportOpen(true)}
            className="inline-flex items-center gap-2 border border-sand bg-white text-charcoal rounded-lg px-4 py-2 text-sm font-medium hover:bg-cream transition-colors">
            <Download size={15} />Export
          </button>
        </div>

        {!fetching && entries.length === 0 && (
          <div className="bg-white border border-sand rounded-2xl p-12 text-center space-y-3">
            <p className="text-taupe text-sm">
              {search || dateFrom || dateTo ? "No results match your filters." : "No outward entries recorded yet."}
            </p>
            <Link href="/ink-outward/new"
              className="inline-flex items-center gap-2 bg-rust text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-rust/90 transition-colors">
              <Plus size={16} />Create First Entry
            </Link>
          </div>
        )}

        {!fetching && entries.length > 0 && (
          <div className="bg-white border border-sand rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-cream text-left text-xs uppercase tracking-wide text-taupe">
                  <th className="px-5 py-3 font-semibold">Date</th>
                  <th className="px-5 py-3 font-semibold">Time</th>
                  <th className="px-5 py-3 font-semibold hidden sm:table-cell">Job</th>
                  <th className="px-5 py-3 font-semibold hidden sm:table-cell">Items</th>
                  <th className="px-5 py-3 font-semibold">Total (Kg)</th>
                  <th className="px-5 py-3 font-semibold hidden md:table-cell">Issued By</th>
                  <th className="px-5 py-3 font-semibold hidden md:table-cell">Received By</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id}
                    onClick={() => router.push(`/ink-outward/${entry.id}`)}
                    className="border-t border-sand hover:bg-cream/60 cursor-pointer transition-colors">
                    <td className="px-5 py-3 font-medium text-charcoal whitespace-nowrap">
                      {new Date(entry.outward_date).toLocaleDateString("en-GB")}
                    </td>
                    <td className="px-5 py-3 text-charcoal">
                      {entry.outward_time ? String(entry.outward_time).slice(0, 5) : "—"}
                    </td>
                    <td className="px-5 py-3 hidden sm:table-cell">
                      <p className="text-sm text-charcoal truncate max-w-[140px]">{entry.job_name || "—"}</p>
                      {entry.job_card_number && (
                        <p className="text-xs text-taupe">{entry.job_card_number}</p>
                      )}
                    </td>
                    <td className="px-5 py-3 hidden sm:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {entry.item_summaries.slice(0, 2).map((s, i) => (
                          <span key={i} className="text-xs bg-rust/10 text-rust rounded-full px-2 py-0.5 truncate max-w-[120px]">{s}</span>
                        ))}
                        {entry.item_summaries.length > 2 && (
                          <span className="text-xs text-taupe">+{entry.item_summaries.length - 2} more</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3 font-semibold text-charcoal">
                      {entry.total_weight_issued.toLocaleString()}
                    </td>
                    <td className="px-5 py-3 text-taupe hidden md:table-cell">{entry.issued_by || "—"}</td>
                    <td className="px-5 py-3 text-taupe hidden md:table-cell">{entry.received_by || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      <ExportModal isOpen={exportOpen} onClose={() => setExportOpen(false)} moduleName="Ink & Varnishes Outward" onExport={handleExport} />
    </div>
  );
}
