"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import AppHeader from "@/components/AppHeader";
import ItemSummaries from "@/components/ItemSummaries";
import ExportModal from "@/components/ExportModal";
import { exportMicroInward } from "@/lib/exportUtils";
import api from "@/lib/api";
import { MicroInwardListItem, MicroMaterialType } from "@/types/micro";
import { Download, Plus, Search } from "lucide-react";

function MaterialTypeBadge({ type }: { type: MicroMaterialType }) {
  const map: Record<MicroMaterialType, string> = {
    Plates: "bg-blue-100 text-blue-700 border border-blue-200",
    Chemicals: "bg-green-100 text-green-700 border border-green-200",
    Films: "bg-purple-100 text-purple-700 border border-purple-200",
  };
  return (
    <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${map[type]}`}>
      {type}
    </span>
  );
}

export default function MicroListPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [entries, setEntries] = useState<MicroInwardListItem[]>([]);
  const [fetching, setFetching] = useState(true);
  const [exportOpen, setExportOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [todayPlates, setTodayPlates] = useState(0);
  const [todayChemicals, setTodayChemicals] = useState(0);
  const [todayFilms, setTodayFilms] = useState(0);

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
      const res = await api.get("/api/micro", { params });
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

  useEffect(() => {
    if (!user) return;
    api.get("/api/micro/dashboard")
      .then((res) => {
        setTodayPlates(res.data.plates_today ?? 0);
        setTodayChemicals(res.data.chemicals_today ?? 0);
        setTodayFilms(res.data.films_today ?? 0);
      })
      .catch(() => {});
  }, [user]);

  const handleExport = async (format: "pdf" | "excel", df: string, dt: string, rangeLabel: string) => {
    const params: Record<string, string> = {};
    if (df) params.date_from = df;
    if (dt) params.date_to = dt;
    const res = await api.get("/api/micro/export", { params });
    exportMicroInward(res.data, format, rangeLabel);
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
      <AppHeader title="Micro Plates, Films & Chemicals" backHref="/dashboard" />
      <main className="max-w-6xl mx-auto px-6 py-10">

        {/* Analytics strip */}
        <div className="bg-white border border-sand rounded-2xl p-5 mb-6 grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="bg-blue-50 rounded-xl px-4 py-3">
            <p className="text-xs text-blue-600 font-medium mb-0.5">Plates Today</p>
            <p className="text-2xl font-bold text-blue-800">{todayPlates}</p>
          </div>
          <div className="bg-green-50 rounded-xl px-4 py-3">
            <p className="text-xs text-green-600 font-medium mb-0.5">Chemicals Today</p>
            <p className="text-2xl font-bold text-green-800">{todayChemicals}</p>
          </div>
          <div className="bg-purple-50 rounded-xl px-4 py-3 col-span-2 sm:col-span-1">
            <p className="text-xs text-purple-600 font-medium mb-0.5">Films Today</p>
            <p className="text-2xl font-bold text-purple-800">{todayFilms}</p>
          </div>
        </div>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-semibold text-charcoal">Micro Inward Entries</h2>
            <p className="text-sm text-taupe">All recorded micro plates, films and chemicals inward transactions.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setExportOpen(true)}
              className="inline-flex items-center gap-2 border border-sand bg-white text-charcoal rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-cream transition-colors"
            >
              <Download size={15} />Export
            </button>
            <Link
              href="/micro/new"
              className="inline-flex items-center gap-2 bg-rust text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-rust/90 transition-colors"
            >
              <Plus size={16} />Create New Entry
            </Link>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white border border-sand rounded-2xl p-4 mb-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-taupe pointer-events-none" />
            <input
              type="text"
              placeholder="Search supplier, material, remarks…"
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
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-cream text-left text-taupe text-xs uppercase tracking-wide">
                  <th className="px-5 py-3 font-medium">Date</th>
                  <th className="px-5 py-3 font-medium">Time</th>
                  <th className="px-5 py-3 font-medium">Supplier</th>
                  <th className="px-5 py-3 font-medium">Type</th>
                  <th className="px-5 py-3 font-medium">Items</th>
                  <th className="px-5 py-3 font-medium">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr
                    key={entry.id}
                    onClick={() => router.push(`/micro/${entry.id}`)}
                    className="border-t border-sand hover:bg-cream/60 cursor-pointer transition-colors"
                  >
                    <td className="px-5 py-3 text-charcoal font-medium">
                      {new Date(entry.inward_date).toLocaleDateString("en-GB")}
                    </td>
                    <td className="px-5 py-3 text-charcoal">{entry.inward_time?.slice(0, 5)}</td>
                    <td className="px-5 py-3 text-charcoal">{entry.supplier_name}</td>
                    <td className="px-5 py-3">
                      <MaterialTypeBadge type={entry.material_type} />
                    </td>
                    <td className="px-5 py-3">
                      <ItemSummaries summaries={entry.item_summaries} />
                    </td>
                    <td className="px-5 py-3 text-taupe">{entry.remarks || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      <ExportModal
        isOpen={exportOpen}
        onClose={() => setExportOpen(false)}
        moduleName="Micro Inward"
        onExport={handleExport}
      />
    </div>
  );
}
