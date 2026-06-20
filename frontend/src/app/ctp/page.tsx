"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import AppHeader from "@/components/AppHeader";
import ItemSummaries from "@/components/ItemSummaries";
import ExportModal from "@/components/ExportModal";
import CTPAnalytics from "@/components/analytics/CTPAnalytics";
import { exportCTP } from "@/lib/exportUtils";
import api from "@/lib/api";
import { CTPInwardListItem } from "@/types/ctp";
import { Download, Plus, Search } from "lucide-react";

export default function CTPListPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [entries, setEntries] = useState<CTPInwardListItem[]>([]);
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
      const res = await api.get("/api/ctp", { params });
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
    const res = await api.get("/api/ctp/export", { params });
    exportCTP(res.data, format, rangeLabel);
  };

  if (loading || !user) {
    return <div className="min-h-screen flex items-center justify-center bg-cream"><p className="text-taupe">Loading...</p></div>;
  }

  return (
    <div className="min-h-screen bg-cream">
      <AppHeader title="CTP Plates" backHref="/dashboard" />
      <main className="max-w-6xl mx-auto px-6 py-10">
        <CTPAnalytics />
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-semibold text-charcoal">CTP Plates Inward Entries</h2>
            <p className="text-sm text-taupe">All recorded CTP plates inward transactions.</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setExportOpen(true)}
              className="inline-flex items-center gap-2 border border-sand bg-white text-charcoal rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-cream transition-colors">
              <Download size={15} />Export
            </button>
            <Link href="/ctp/new"
              className="inline-flex items-center gap-2 bg-rust text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-rust/90 transition-colors">
              <Plus size={16} />Create New Entry
            </Link>
          </div>
        </div>

        <div className="bg-white border border-sand rounded-2xl p-4 mb-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-taupe pointer-events-none" />
            <input type="text" placeholder="Search supplier, plate size, checked by, remarks…"
              value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-sand bg-cream/40 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust" />
          </div>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
            className="w-full rounded-lg border border-sand bg-cream/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust" title="From date" />
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
            className="w-full rounded-lg border border-sand bg-cream/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust" title="To date" />
        </div>

        {fetching ? (
          <p className="text-sm text-taupe">Loading entries...</p>
        ) : entries.length === 0 ? (
          <div className="bg-white border border-sand rounded-2xl p-12 text-center">
            <p className="text-taupe">{search || dateFrom || dateTo ? "No entries match your search." : "No entries done yet."}</p>
          </div>
        ) : (
          <div className="bg-white border border-sand rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-cream text-left text-taupe text-xs uppercase tracking-wide">
                  <th className="px-5 py-3 font-medium">Date</th>
                  <th className="px-5 py-3 font-medium">Time</th>
                  <th className="px-5 py-3 font-medium">Supplier</th>
                  <th className="px-5 py-3 font-medium">Plate Size(s)</th>
                  <th className="px-5 py-3 font-medium">Total Plates</th>
                  <th className="px-5 py-3 font-medium">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id} onClick={() => router.push(`/ctp/${entry.id}`)}
                    className="border-t border-sand hover:bg-cream/60 cursor-pointer transition-colors">
                    <td className="px-5 py-3 text-charcoal font-medium">{new Date(entry.inward_date).toLocaleDateString("en-GB")}</td>
                    <td className="px-5 py-3 text-charcoal">{entry.inward_time?.slice(0, 5)}</td>
                    <td className="px-5 py-3 text-charcoal">{entry.supplier_name}</td>
                    <td className="px-5 py-3"><ItemSummaries summaries={entry.item_summaries} /></td>
                    <td className="px-5 py-3 text-charcoal">{entry.grand_total_plates}</td>
                    <td className="px-5 py-3 text-taupe">{entry.remarks || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
      <ExportModal isOpen={exportOpen} onClose={() => setExportOpen(false)} moduleName="CTP Plates" onExport={handleExport} />
    </div>
  );
}
