"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import AppHeader from "@/components/AppHeader";
import DieMovementAnalyticsComponent from "@/components/analytics/DieMovementAnalytics";
import ExportModal from "@/components/ExportModal";
import api from "@/lib/api";
import { DieMovementListItem } from "@/types/die-movement";
import { exportDieMovement } from "@/lib/exportUtils";
import { Download, Plus, Search } from "lucide-react";

export default function DiesOutwardDashboard() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [entries, setEntries] = useState<DieMovementListItem[]>([]);
  const [fetching, setFetching] = useState(true);
  const [exportOpen, setExportOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => { if (!loading && !user) router.replace("/login"); }, [user, loading, router]);

  const fetchEntries = useCallback(async () => {
    setFetching(true);
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      const res = await api.get("/api/die-movement", { params });
      setEntries(res.data);
    } finally { setFetching(false); }
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
    const res = await api.get("/api/die-movement/export", { params });
    exportDieMovement(res.data, format, rangeLabel);
  };

  if (loading || !user) return <div className="min-h-screen flex items-center justify-center bg-cream"><p className="text-taupe">Loading...</p></div>;

  return (
    <div className="min-h-screen bg-cream">
      <AppHeader title="Dies Movement" backHref="/outward" />
      <main className="max-w-6xl mx-auto px-6 py-10 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-charcoal">✂️ Dies Movement Dashboard</h1>
            <p className="text-sm text-taupe mt-0.5">Track die locations and movement history</p>
          </div>
          <Link href="/dies-outward/new" className="inline-flex items-center gap-2 bg-rust text-white rounded-xl px-5 py-2.5 text-sm font-semibold hover:bg-rust/90 transition-colors">
            <Plus size={16} />Record New Movement
          </Link>
        </div>

        <DieMovementAnalyticsComponent />

        <div className="bg-white border border-sand rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-taupe pointer-events-none" />
            <input type="text" placeholder="Search by die no., job name, location, person…" value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-sand bg-cream/40 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust" />
          </div>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} title="From date"
            className="w-full rounded-lg border border-sand bg-cream/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust" />
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} title="To date"
            className="w-full rounded-lg border border-sand bg-cream/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust" />
        </div>

        <div className="flex items-center justify-between">
          <p className="text-sm text-taupe">{fetching ? "Loading…" : `${entries.length} movement${entries.length === 1 ? "" : "s"}`}</p>
          <button onClick={() => setExportOpen(true)} className="inline-flex items-center gap-2 border border-sand bg-white text-charcoal rounded-lg px-4 py-2 text-sm font-medium hover:bg-cream transition-colors">
            <Download size={15} />Export
          </button>
        </div>

        {!fetching && entries.length === 0 && (
          <div className="bg-white border border-sand rounded-2xl p-12 text-center space-y-3">
            <p className="text-taupe text-sm">{search || dateFrom || dateTo ? "No results match your filters." : "No die movements recorded yet."}</p>
            <Link href="/dies-outward/new" className="inline-flex items-center gap-2 bg-rust text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-rust/90 transition-colors">
              <Plus size={16} />Record First Movement
            </Link>
          </div>
        )}

        {!fetching && entries.length > 0 && (
          <div className="bg-white border border-sand rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-cream text-left text-xs uppercase tracking-wide text-taupe">
                  <th className="px-5 py-3 font-semibold">Date</th>
                  <th className="px-5 py-3 font-semibold">Die No.</th>
                  <th className="px-5 py-3 font-semibold hidden sm:table-cell">Job Name</th>
                  <th className="px-5 py-3 font-semibold hidden sm:table-cell">Issued To</th>
                  <th className="px-5 py-3 font-semibold hidden md:table-cell">Location</th>
                  <th className="px-5 py-3 font-semibold hidden md:table-cell">Issued By</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id} onClick={() => router.push(`/dies-outward/${entry.id}`)}
                    className="border-t border-sand hover:bg-cream/60 cursor-pointer transition-colors">
                    <td className="px-5 py-3 font-medium text-charcoal whitespace-nowrap">{new Date(entry.movement_date).toLocaleDateString("en-GB")}</td>
                    <td className="px-5 py-3 font-medium text-charcoal">{entry.die_number}</td>
                    <td className="px-5 py-3 text-taupe hidden sm:table-cell truncate max-w-[160px]">{entry.job_name}</td>
                    <td className="px-5 py-3 text-taupe hidden sm:table-cell">{entry.issued_to}</td>
                    <td className="px-5 py-3 text-taupe hidden md:table-cell">{entry.current_location || "—"}</td>
                    <td className="px-5 py-3 text-taupe hidden md:table-cell">{entry.issued_by || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
      <ExportModal isOpen={exportOpen} onClose={() => setExportOpen(false)} moduleName="Dies Movement" onExport={handleExport} />
    </div>
  );
}
