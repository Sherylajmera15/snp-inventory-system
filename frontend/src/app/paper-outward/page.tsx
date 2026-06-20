"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import AppHeader from "@/components/AppHeader";
import PaperOutwardAnalytics from "@/components/analytics/PaperOutwardAnalytics";
import api from "@/lib/api";
import { PaperOutwardListItem } from "@/types/paper-outward";
import { Download, Plus, Search } from "lucide-react";
import { exportPaperOutward } from "@/lib/exportUtils";
import ExportModal from "@/components/ExportModal";

export default function PaperOutwardListPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [entries, setEntries] = useState<PaperOutwardListItem[]>([]);
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
      const res = await api.get("/api/paper-outward", { params });
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
    const res = await api.get("/api/paper-outward/export", { params });
    exportPaperOutward(res.data, format, rangeLabel);
  };

  if (loading || !user) {
    return <div className="min-h-screen flex items-center justify-center bg-cream"><p className="text-taupe">Loading...</p></div>;
  }

  return (
    <div className="min-h-screen bg-cream">
      <AppHeader title="Paper Outward" backHref="/outward" />
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-6">
        {/* Dashboard heading */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-charcoal">📄 Paper Outward Dashboard</h1>
            <p className="text-sm text-taupe mt-0.5">Paper issued for production</p>
          </div>
          <Link href="/paper-outward/new"
            className="inline-flex items-center gap-2 bg-rust text-white rounded-xl px-5 py-2.5 text-sm font-semibold hover:bg-rust/90 transition-colors">
            <Plus size={16} />Create New Outward Entry
          </Link>
        </div>

        <PaperOutwardAnalytics />

        {/* Filters */}
        <div className="bg-white border border-sand rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-taupe pointer-events-none" />
            <input type="text" placeholder="Search job name, quality, GSM…"
              value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-sand bg-cream/40 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust" />
          </div>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            className="w-full rounded-lg border border-sand bg-cream/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust" title="From date" />
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            className="w-full rounded-lg border border-sand bg-cream/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust" title="To date" />
        </div>

        {/* Header row */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-taupe">
            {fetching ? "Loading…" : `${entries.length} entr${entries.length === 1 ? "y" : "ies"}`}
          </p>
          <button onClick={() => setExportOpen(true)}
            className="inline-flex items-center gap-2 border border-sand bg-white text-charcoal rounded-lg px-4 py-2 text-sm font-medium hover:bg-cream transition-colors">
            <Download size={15} />Export
          </button>
        </div>

        {/* Empty state */}
        {!fetching && entries.length === 0 && (
          <div className="bg-white border border-sand rounded-2xl p-12 text-center space-y-3">
            <p className="text-taupe text-sm">
              {search || dateFrom || dateTo ? "No results match your filters." : "No outward entries recorded yet."}
            </p>
            <Link href="/paper-outward/new"
              className="inline-flex items-center gap-2 bg-rust text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-rust/90 transition-colors">
              <Plus size={16} />Create First Entry
            </Link>
          </div>
        )}

        {/* Table */}
        {!fetching && entries.length > 0 && (
          <div className="bg-white border border-sand rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-cream text-left text-xs uppercase tracking-wide text-taupe">
                  <th className="px-5 py-3 font-semibold">Date</th>
                  <th className="px-5 py-3 font-semibold">Time</th>
                  <th className="px-5 py-3 font-semibold">Job Name</th>
                  <th className="px-5 py-3 font-semibold hidden sm:table-cell">Paper Issued</th>
                  <th className="px-5 py-3 font-semibold hidden md:table-cell">Issued By</th>
                  <th className="px-5 py-3 font-semibold hidden md:table-cell">Received By</th>
                  <th className="px-5 py-3 font-semibold text-right">Items</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id}
                    onClick={() => router.push(`/paper-outward/${entry.id}`)}
                    className="border-t border-sand hover:bg-cream/60 cursor-pointer transition-colors">
                    <td className="px-5 py-3 text-charcoal font-medium whitespace-nowrap">
                      {new Date(entry.outward_date).toLocaleDateString("en-GB")}
                    </td>
                    <td className="px-5 py-3 text-charcoal">
                      {entry.outward_time ? String(entry.outward_time).slice(0, 5) : "—"}
                    </td>
                    <td className="px-5 py-3 text-charcoal font-medium">{entry.job_name}</td>
                    <td className="px-5 py-3 hidden sm:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {entry.item_summaries.slice(0, 2).map((s, i) => (
                          <span key={i} className="text-xs bg-rust/10 text-rust rounded-full px-2 py-0.5">{s}</span>
                        ))}
                        {entry.item_summaries.length > 2 && (
                          <span className="text-xs text-taupe">+{entry.item_summaries.length - 2} more</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-taupe hidden md:table-cell">{entry.issued_by || "—"}</td>
                    <td className="px-5 py-3 text-taupe hidden md:table-cell">{entry.received_by || "—"}</td>
                    <td className="px-5 py-3 text-right">
                      <span className="inline-flex items-center justify-center bg-rust/10 text-rust rounded-full w-7 h-7 text-xs font-semibold">
                        {entry.item_count}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
      <ExportModal isOpen={exportOpen} onClose={() => setExportOpen(false)} moduleName="Paper Outward" onExport={handleExport} />
    </div>
  );
}
