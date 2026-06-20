"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import AppHeader from "@/components/AppHeader";
import ItemSummaries from "@/components/ItemSummaries";
import ExportModal from "@/components/ExportModal";
import DiesAnalytics from "@/components/analytics/DiesAnalytics";
import { exportDies } from "@/lib/exportUtils";
import api from "@/lib/api";
import { DiesInwardListItem, DieItemSearchResult } from "@/types/dies";
import { Download, Plus, Search } from "lucide-react";

const STATUS_OPTIONS = ["All", "Active", "Discontinued"];

export default function DiesListPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [entries, setEntries] = useState<DiesInwardListItem[]>([]);
  const [dieItems, setDieItems] = useState<DieItemSearchResult[]>([]);
  const [fetching, setFetching] = useState(true);
  const [exportOpen, setExportOpen] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("");

  const isItemSearch = search.trim().length > 0;

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  const fetchData = useCallback(async () => {
    setFetching(true);
    try {
      if (isItemSearch) {
        const params: Record<string, string> = { search: search.trim() };
        if (statusFilter !== "All") params.status = statusFilter;
        const res = await api.get("/api/dies/items", { params });
        setDieItems(res.data);
        setEntries([]);
      } else {
        const params: Record<string, string> = {};
        if (statusFilter !== "All") params.status = statusFilter;
        if (dateFrom) params.date_from = dateFrom;
        if (dateTo) params.date_to = dateTo;
        if (supplierFilter) params.supplier = supplierFilter;
        const res = await api.get("/api/dies", { params });
        setEntries(res.data);
        setDieItems([]);
      }
    } finally {
      setFetching(false);
    }
  }, [search, isItemSearch, statusFilter, dateFrom, dateTo, supplierFilter]);

  useEffect(() => {
    if (!user) return;
    const t = setTimeout(fetchData, 300);
    return () => clearTimeout(t);
  }, [user, fetchData]);

  const handleExport = async (format: "pdf" | "excel", df: string, dt: string, rangeLabel: string) => {
    const params: Record<string, string> = {};
    if (df) params.date_from = df;
    if (dt) params.date_to = dt;
    const res = await api.get("/api/dies/export", { params });
    exportDies(res.data, format, rangeLabel);
  };

  if (loading || !user) {
    return <div className="min-h-screen flex items-center justify-center bg-cream"><p className="text-taupe">Loading...</p></div>;
  }

  const resultCount = isItemSearch ? dieItems.length : entries.length;

  return (
    <div className="min-h-screen bg-cream">
      <AppHeader title="Dies" backHref="/dashboard" />
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-6">
        <DiesAnalytics />

        {/* Search + Filters */}
        <div className="bg-white border border-sand rounded-2xl p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-taupe pointer-events-none" />
              <input
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-sand bg-cream/40 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust"
                placeholder="Search die number, job name, storage location…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              className="w-full rounded-lg border border-sand bg-cream/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>Status: {s}</option>
              ))}
            </select>
          </div>
          {!isItemSearch && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input type="date" title="Date from"
                className="w-full rounded-lg border border-sand bg-cream/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust"
                value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              <input type="date" title="Date to"
                className="w-full rounded-lg border border-sand bg-cream/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust"
                value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              <input
                className="w-full rounded-lg border border-sand bg-cream/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust"
                placeholder="Filter by supplier…"
                value={supplierFilter} onChange={(e) => setSupplierFilter(e.target.value)} />
            </div>
          )}
        </div>

        {/* Header row */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-taupe">
            {fetching
              ? "Loading…"
              : isItemSearch
                ? `${resultCount} die${resultCount === 1 ? "" : "s"} found`
                : `${resultCount} entr${resultCount === 1 ? "y" : "ies"}`}
          </p>
          <div className="flex items-center gap-2">
            <button onClick={() => setExportOpen(true)}
              className="inline-flex items-center gap-2 border border-sand bg-white text-charcoal rounded-lg px-4 py-2 text-sm font-medium hover:bg-cream transition-colors">
              <Download size={15} />Export
            </button>
            <Link href="/dies/new"
              className="inline-flex items-center gap-2 bg-rust text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-rust/90 transition-colors">
              <Plus size={16} />New Entry
            </Link>
          </div>
        </div>

        {/* Empty state */}
        {!fetching && resultCount === 0 && (
          <div className="bg-white border border-sand rounded-2xl p-10 text-center space-y-3">
            <p className="text-taupe text-sm">
              {search || statusFilter !== "All" || dateFrom || dateTo || supplierFilter
                ? "No results match your filters."
                : "No entries found."}
            </p>
            {!isItemSearch && (
              <Link href="/dies/new"
                className="inline-flex items-center gap-2 bg-rust text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-rust/90 transition-colors">
                <Plus size={16} />Create First Entry
              </Link>
            )}
          </div>
        )}

        {/* Item-level search results */}
        {!fetching && isItemSearch && dieItems.length > 0 && (
          <div className="bg-white border border-sand rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-sand bg-cream/40">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-taupe uppercase tracking-wide">Date</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-taupe uppercase tracking-wide">Supplier</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-taupe uppercase tracking-wide">Die Number</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-taupe uppercase tracking-wide">Job Name</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-taupe uppercase tracking-wide">UPS</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-taupe uppercase tracking-wide hidden md:table-cell">Embossing</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-taupe uppercase tracking-wide hidden md:table-cell">Rubberized</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-taupe uppercase tracking-wide">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-taupe uppercase tracking-wide hidden lg:table-cell">Location</th>
                </tr>
              </thead>
              <tbody>
                {dieItems.map((item) => (
                  <tr key={item.id} onClick={() => router.push(`/dies/${item.inward_id}`)}
                    className="border-b border-sand/50 hover:bg-cream/60 cursor-pointer transition-colors">
                    <td className="px-4 py-3 text-charcoal font-medium whitespace-nowrap">
                      {new Date(item.inward_date).toLocaleDateString("en-GB")}
                    </td>
                    <td className="px-4 py-3 text-charcoal">{item.supplier_name}</td>
                    <td className="px-4 py-3 text-charcoal font-medium">{item.die_number}</td>
                    <td className="px-4 py-3 text-charcoal">{item.job_name}</td>
                    <td className="px-4 py-3 text-charcoal">{item.ups}</td>
                    <td className="px-4 py-3 text-charcoal hidden md:table-cell">{item.embossing}</td>
                    <td className="px-4 py-3 text-charcoal hidden md:table-cell">{item.rubberized}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        item.status === "Active" ? "bg-green-100 text-green-700" : "bg-sand text-taupe"
                      }`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-taupe hidden lg:table-cell">{item.storage_location || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Transaction list (no search) */}
        {!fetching && !isItemSearch && entries.length > 0 && (
          <div className="bg-white border border-sand rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-sand bg-cream/40">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-taupe uppercase tracking-wide">Date</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-taupe uppercase tracking-wide">Time</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-taupe uppercase tracking-wide">Supplier</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-taupe uppercase tracking-wide">Die(s)</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-taupe uppercase tracking-wide hidden sm:table-cell">Remarks</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-taupe uppercase tracking-wide">Count</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id} onClick={() => router.push(`/dies/${entry.id}`)}
                    className="border-b border-sand/50 hover:bg-cream/60 cursor-pointer transition-colors">
                    <td className="px-4 py-3 text-charcoal font-medium whitespace-nowrap">
                      {new Date(entry.inward_date).toLocaleDateString("en-GB")}
                    </td>
                    <td className="px-4 py-3 text-charcoal">{entry.inward_time?.slice(0, 5) || "—"}</td>
                    <td className="px-4 py-3 text-charcoal">{entry.supplier_name}</td>
                    <td className="px-4 py-3"><ItemSummaries summaries={entry.item_summaries} /></td>
                    <td className="px-4 py-3 text-taupe hidden sm:table-cell">{entry.remarks || "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <span className="inline-flex items-center justify-center bg-rust/10 text-rust rounded-full w-7 h-7 text-xs font-semibold">
                        {entry.die_count}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
      <ExportModal isOpen={exportOpen} onClose={() => setExportOpen(false)} moduleName="Dies" onExport={handleExport} />
    </div>
  );
}
