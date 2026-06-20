"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import AppHeader from "@/components/AppHeader";
import api from "@/lib/api";
import { Activity, FileStack, Layers, Droplet, FlaskConical, PaintBucket, Package, Box, Fuel, Scissors } from "lucide-react";

interface ActivityEntry {
  id: number;
  username: string;
  module: string;
  action: "created" | "edited" | "deleted" | "protected_edit";
  entry_id: number | null;
  created_at: string;
  details?: string | null;
}

const MODULE_ICONS: Record<string, React.ReactNode> = {
  "Paper": <FileStack size={13} />,
  "CTP Plates": <Layers size={13} />,
  "Ink & Varnishes": <Droplet size={13} />,
  "Chemicals": <FlaskConical size={13} />,
  "Adhesives": <PaintBucket size={13} />,
  "Consumables": <Box size={13} />,
  "Packing Materials": <Package size={13} />,
  "Oil & Lubrication": <Fuel size={13} />,
  "Dies": <Scissors size={13} />,
};

const MODULE_HREFS: Record<string, string> = {
  "Paper": "/paper",
  "CTP Plates": "/ctp",
  "Ink & Varnishes": "/ink",
  "Chemicals": "/chemicals",
  "Adhesives": "/adhesives",
  "Consumables": "/consumables",
  "Packing Materials": "/packing",
  "Oil & Lubrication": "/oil",
  "Dies": "/dies",
};

const ACTION_STYLES: Record<string, string> = {
  created: "bg-green-50 text-green-700 border-green-200",
  edited: "bg-blue-50 text-blue-700 border-blue-200",
  deleted: "bg-red-50 text-red-700 border-red-200",
  protected_edit: "bg-amber-50 text-amber-700 border-amber-200",
};

function fmtDateTime(s: string) {
  if (!s) return "—";
  try {
    const d = new Date(s);
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
      + " " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  } catch { return s; }
}

export default function ActivityCenterPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [fetching, setFetching] = useState(true);
  const [moduleFilter, setModuleFilter] = useState("");
  const [usernameFilter, setUsernameFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [modules, setModules] = useState<string[]>([]);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    api.get("/api/analytics/activity/modules").then((r) => setModules(r.data)).catch(() => {});
  }, [user]);

  const fetch = useCallback(async () => {
    if (!user) return;
    setFetching(true);
    try {
      const params: Record<string, string> = {};
      if (moduleFilter) params.module = moduleFilter;
      if (usernameFilter) params.username = usernameFilter;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      const res = await api.get("/api/analytics/activity", { params });
      setEntries(res.data);
    } finally { setFetching(false); }
  }, [user, moduleFilter, usernameFilter, dateFrom, dateTo]);

  useEffect(() => { fetch(); }, [fetch]);

  if (loading || !user) {
    return <div className="min-h-screen flex items-center justify-center bg-cream"><p className="text-taupe">Loading...</p></div>;
  }

  return (
    <div className="min-h-screen bg-cream">
      <AppHeader title="Activity Center" backHref="/dashboard" />

      <main className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex items-center gap-2">
            <Activity size={20} className="text-rust" />
            <div>
              <h2 className="text-xl font-semibold text-charcoal">Activity Log</h2>
              <p className="text-sm text-taupe">All system events — creates, edits, and deletes across all modules.</p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white border border-sand rounded-2xl p-4 mb-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <select
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
            className="rounded-lg border border-sand bg-cream/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust"
          >
            <option value="">All Modules</option>
            {modules.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <input
            type="text"
            placeholder="Filter by user…"
            value={usernameFilter}
            onChange={(e) => setUsernameFilter(e.target.value)}
            className="rounded-lg border border-sand bg-cream/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust"
          />
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-lg border border-sand bg-cream/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust"
            title="From date"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-lg border border-sand bg-cream/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust"
            title="To date"
          />
        </div>

        {fetching ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-white border border-sand rounded-xl h-12 animate-pulse" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="bg-white border border-sand rounded-2xl p-12 text-center">
            <Activity size={36} className="text-sand mx-auto mb-3" />
            <p className="text-taupe">No activity recorded yet. Activity is logged automatically when entries are created, edited, or deleted.</p>
          </div>
        ) : (
          <div className="bg-white border border-sand rounded-2xl overflow-hidden">
            <div className="px-5 py-3 border-b border-sand bg-cream">
              <p className="text-xs text-taupe">{entries.length} event{entries.length !== 1 ? "s" : ""} found</p>
            </div>
            <div className="divide-y divide-sand/50">
              {entries.map((e) => {
                const href = e.entry_id ? `${MODULE_HREFS[e.module] || ""}/${e.entry_id}` : null;
                const icon = MODULE_ICONS[e.module];
                const actionCls = ACTION_STYLES[e.action] || "bg-gray-50 text-gray-700 border-gray-200";

                return (
                  <div key={e.id} className="flex items-center gap-4 px-5 py-3 hover:bg-cream/40 transition-colors">
                    {/* Date / Time */}
                    <div className="w-32 shrink-0">
                      <p className="text-xs font-medium text-charcoal">{fmtDateTime(e.created_at)}</p>
                    </div>

                    {/* User */}
                    <div className="w-20 shrink-0">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-sand text-charcoal capitalize">
                        {e.username}
                      </span>
                    </div>

                    {/* Action */}
                    <div className="shrink-0">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border capitalize ${actionCls}`}>
                        {e.action === "protected_edit" ? "protected edit" : e.action}
                      </span>
                      {e.details && <p className="text-xs text-taupe mt-0.5">{e.details}</p>}
                    </div>

                    {/* Module */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-taupe">{icon}</span>
                      <span className="text-sm text-charcoal">{e.module}</span>
                    </div>

                    {/* Entry link */}
                    <div className="flex-1 min-w-0">
                      {href ? (
                        <Link href={href} className="text-xs text-rust hover:underline">
                          Entry #{e.entry_id} →
                        </Link>
                      ) : (
                        <span className="text-xs text-taupe">—</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
