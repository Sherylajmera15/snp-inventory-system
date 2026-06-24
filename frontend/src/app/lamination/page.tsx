"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import AppHeader from "@/components/AppHeader";
import api from "@/lib/api";
import { LaminationInwardListItem } from "@/types/lamination";
import { Download, Plus, Search, LayoutDashboard } from "lucide-react";
import ExportModal from "@/components/ExportModal";
import { exportLaminationInward } from "@/lib/exportUtils";

function filmTypeLabel(film_type: string, custom_type?: string | null) {
  if (film_type === "OTHER" && custom_type) return custom_type;
  return film_type;
}

function filmTypeBadgeClass(film_type: string) {
  switch (film_type) {
    case "PVC": return "bg-blue-50 text-blue-700 border border-blue-200";
    case "BOPP": return "bg-green-50 text-green-700 border border-green-200";
    case "SILVER": return "bg-gray-100 text-gray-700 border border-gray-200";
    case "HOLOGRAPHIC": return "bg-purple-50 text-purple-700 border border-purple-200";
    default: return "bg-amber-50 text-amber-700 border border-amber-200";
  }
}

export default function LaminationListPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [entries, setEntries] = useState<LaminationInwardListItem[]>([]);
  const [fetching, setFetching] = useState(true);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [exportOpen, setExportOpen] = useState(false);

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
      const res = await api.get("/api/lamination", { params });
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

  const handleExport = async (format: "pdf" | "excel", from: string, to: string, rangeLabel: string) => {
    const params: Record<string, string> = {};
    if (from) params.date_from = from;
    if (to) params.date_to = to;
    const res = await api.get("/api/lamination/export", { params });
    exportLaminationInward(res.data, format, rangeLabel);
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream">
        <p className="text-taupe">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream">
      <AppHeader title="Lamination Film" backHref="/dashboard" />
      <main className="max-w-6xl mx-auto px-6 py-10">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-semibold text-charcoal">Lamination Film Inward</h2>
            <p className="text-sm text-taupe">All recorded lamination film inward transactions.</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/lamination/dashboard"
              className="inline-flex items-center gap-2 border border-sand bg-white text-charcoal rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-cream transition-colors"
            >
              <LayoutDashboard size={15} />Dashboard
            </Link>
            <button
              onClick={() => setExportOpen(true)}
              className="inline-flex items-center gap-2 border border-sand bg-white text-charcoal rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-cream transition-colors"
            >
              <Download size={15} />Export
            </button>
            <Link
              href="/lamination/new"
              className="inline-flex items-center gap-2 bg-rust text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-rust/90 transition-colors"
            >
              <Plus size={16} />New Entry
            </Link>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white border border-sand rounded-2xl p-4 mb-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-taupe pointer-events-none" />
            <input
              type="text"
              placeholder="Search supplier, film type, remarks…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-sand bg-cream/40 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust"
            />
          </div>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-full rounded-lg border border-sand bg-cream/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust"
            title="From date"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-full rounded-lg border border-sand bg-cream/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust"
            title="To date"
          />
        </div>

        {/* Table */}
        {fetching ? (
          <p className="text-sm text-taupe">Loading entries...</p>
        ) : entries.length === 0 ? (
          <div className="bg-white border border-sand rounded-2xl p-12 text-center">
            <p className="text-taupe">
              {search || dateFrom || dateTo ? "No entries match your search." : "No entries done yet."}
            </p>
          </div>
        ) : (
          <div className="bg-white border border-sand rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-cream text-left text-taupe text-xs uppercase tracking-wide">
                    <th className="px-5 py-3 font-medium">Date</th>
                    <th className="px-5 py-3 font-medium">Time</th>
                    <th className="px-5 py-3 font-medium">Supplier</th>
                    <th className="px-5 py-3 font-medium">Invoice</th>
                    <th className="px-5 py-3 font-medium">Film Type</th>
                    <th className="px-5 py-3 font-medium">Roll Size</th>
                    <th className="px-5 py-3 font-medium">Rolls</th>
                    <th className="px-5 py-3 font-medium">Total Wt (kg)</th>
                    <th className="px-5 py-3 font-medium">Received By</th>
                    <th className="px-5 py-3 font-medium">Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr
                      key={entry.id}
                      onClick={() => router.push(`/lamination/${entry.id}`)}
                      className="border-t border-sand hover:bg-cream/60 cursor-pointer transition-colors"
                    >
                      <td className="px-5 py-3 text-charcoal font-medium">
                        {new Date(entry.inward_date).toLocaleDateString("en-GB")}
                      </td>
                      <td className="px-5 py-3 text-charcoal">
                        {entry.inward_time ? String(entry.inward_time).slice(0, 5) : "—"}
                      </td>
                      <td className="px-5 py-3 text-charcoal">{entry.supplier_name}</td>
                      <td className="px-5 py-3 text-taupe">{entry.invoice_number || "—"}</td>
                      <td className="px-5 py-3">
                        <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${filmTypeBadgeClass(entry.film_type)}`}>
                          {filmTypeLabel(entry.film_type, entry.custom_type)}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-charcoal">{entry.roll_size || "—"}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-charcoal">{entry.roll_count}</span>
                          {entry.roll_count <= 5 && entry.roll_weights.map((w, i) => (
                            <span key={i} className="text-xs bg-sand/60 border border-sand text-charcoal rounded px-1.5 py-0.5 leading-tight">
                              {w % 1 === 0 ? w : w.toFixed(2)} kg
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-charcoal font-semibold">{entry.total_weight.toFixed(2)}</td>
                      <td className="px-5 py-3 text-charcoal">{entry.received_by}</td>
                      <td className="px-5 py-3 text-taupe truncate max-w-32">{entry.remarks || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
      <ExportModal
        isOpen={exportOpen}
        onClose={() => setExportOpen(false)}
        moduleName="Lamination Film"
        onExport={handleExport}
      />
    </div>
  );
}
