"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import AppHeader from "@/components/AppHeader";
import api from "@/lib/api";
import {
  FileStack, Layers, Droplet, FlaskConical, PaintBucket,
  Package, Box, Fuel, Scissors, Search, X, Clock, TrendingUp, CalendarDays,
  ArrowDownToLine, ArrowUpFromLine, Microscope, Film,
} from "lucide-react";

// ─── Module config ────────────────────────────────────────────────────────────

const MODULES = [
  { key: "paper",       title: "Paper",            emoji: "📄", icon: FileStack,    href: "/paper" },
  { key: "ctp",         title: "CTP Plates",        emoji: "🖨️", icon: Layers,       href: "/ctp" },
  { key: "ink",         title: "Ink & Varnishes",   emoji: "🎨", icon: Droplet,      href: "/ink" },
  { key: "chemicals",   title: "Chemicals",         emoji: "🧪", icon: FlaskConical, href: "/chemicals" },
  { key: "adhesives",   title: "Adhesives",         emoji: "🏷️", icon: PaintBucket,  href: "/adhesives" },
  { key: "consumables", title: "Consumables",       emoji: "🔧", icon: Box,          href: "/consumables" },
  { key: "packing",     title: "Packing Materials", emoji: "📦", icon: Package,      href: "/packing" },
  { key: "oil",         title: "Oil & Lubrication", emoji: "🛢️", icon: Fuel,         href: "/oil" },
  { key: "dies",        title: "Dies",              emoji: "✂️", icon: Scissors,     href: "/dies" },
  { key: "micro",       title: "Micro Plates/Films", emoji: "🔬", icon: Microscope,   href: "/micro" },
  { key: "lamination", title: "Lamination Film",    emoji: "🎞️", icon: Film,          href: "/lamination" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(s: string) {
  if (!s) return "";
  try { return new Date(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return s; }
}

function fmtTime(s: string) {
  if (!s) return "";
  try {
    return new Date(s).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  } catch { return s; }
}

function num(n: number) {
  return n?.toLocaleString() ?? "0";
}

// ─── Module analytics card ────────────────────────────────────────────────────

function ModuleAnalyticsCard({
  mod, data, period,
}: {
  mod: typeof MODULES[0];
  data: Record<string, number | Record<string, number>>;
  period: "today" | "month";
}) {
  const stats = buildModuleStats(mod.key, data, period);
  const periodLabel = period === "today" ? "Today" : "This Month";

  return (
    <Link href={mod.href} className="block h-full">
      <div className="bg-white border-2 border-sand rounded-2xl p-5 hover:border-rust hover:shadow-lg transition-all cursor-pointer h-full flex flex-col group">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl leading-none">{mod.emoji}</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-charcoal group-hover:text-rust transition-colors">{mod.title}</p>
            <span className="text-xs text-taupe">{periodLabel}</span>
          </div>
          <div className="shrink-0 w-2 h-2 rounded-full bg-sand group-hover:bg-rust transition-colors" />
        </div>
        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-2 flex-1">
          {stats.map((s, i) => (
            <div key={i} className="bg-cream rounded-xl px-3 py-2.5">
              <p className="text-xs text-taupe truncate mb-0.5">{s.label}</p>
              <p className="text-lg font-bold text-charcoal leading-tight">{s.value}</p>
            </div>
          ))}
          {/* Fill empty slots to keep grid consistent */}
          {stats.length % 2 !== 0 && (
            <div className="bg-cream/50 rounded-xl px-3 py-2.5 opacity-0 pointer-events-none" />
          )}
        </div>
      </div>
    </Link>
  );
}

function buildModuleStats(key: string, data: Record<string, number | Record<string, number>>, period: "today" | "month") {
  const v = (k: string) => (data[k] as number) ?? 0;
  const breakdown = (data["type_breakdown"] as Record<string, number>) ?? {};
  const sizes = (data["size_breakdown"] as Record<string, number>) ?? {};

  switch (key) {
    case "paper": return period === "today"
      ? [
          { label: "Entries", value: num(v("total_entries")) },
          { label: "Reel Items", value: num(v("reel_items")) },
          { label: "Sheet Items", value: num(v("sheet_items")) },
          { label: "Job Work", value: num(v("job_work")) },
        ]
      : [
          { label: "Entries", value: num(v("total_entries")) },
          { label: "Reel Weight (kg)", value: v("total_reel_weight").toFixed(1) },
          { label: "Total Sheets", value: num(v("total_sheets")) },
          { label: "Job Work", value: num(v("job_work")) },
        ];
    case "ctp": return period === "today"
      ? [
          { label: "Entries", value: num(v("total_entries")) },
          { label: "Total Plates", value: num(v("total_plates")) },
          ...Object.entries(sizes).slice(0, 2).map(([sz, cnt]) => ({ label: sz, value: num(cnt) })),
        ]
      : [
          { label: "Entries", value: num(v("total_entries")) },
          { label: "Total Plates", value: num(v("total_plates")) },
        ];
    case "ink": return period === "today"
      ? [
          { label: "Entries", value: num(v("total_entries")) },
          { label: "UV Ink", value: num(v("uv_ink")) },
          { label: "Conv. Ink", value: num(v("conv_ink")) },
          { label: "UV Varnish", value: num(v("uv_varnish")) },
        ]
      : [
          { label: "Entries", value: num(v("total_entries")) },
          { label: "Total Wt. (kg)", value: v("total_weight").toFixed(2) },
          { label: "UV Ink", value: num(v("uv_ink")) },
          { label: "Conv. Ink", value: num(v("conv_ink")) },
        ];
    case "chemicals":
    case "adhesives":
    case "consumables":
      return [
        { label: "Entries", value: num(v("total_entries")) },
        { label: "Total Qty", value: v("total_qty").toFixed(2) },
      ];
    case "packing": return period === "today"
      ? [
          { label: "Entries", value: num(v("total_entries")) },
          ...Object.entries(breakdown).slice(0, 3).map(([t, q]) => ({ label: t, value: typeof q === "number" ? q.toFixed(1) : String(q) })),
        ]
      : [
          { label: "Entries", value: num(v("total_entries")) },
          ...Object.entries(breakdown).slice(0, 3).map(([t, q]) => ({ label: t, value: typeof q === "number" ? q.toFixed(1) : String(q) })),
        ];
    case "oil":
      return [
        { label: "Entries", value: num(v("total_entries")) },
        { label: "Total Qty", value: v("total_qty").toFixed(2) },
      ];
    case "dies": return period === "today"
      ? [
          { label: "Dies Added", value: num(v("dies_added")) },
          { label: "Active", value: num(v("active")) },
          { label: "Discontinued", value: num(v("discontinued")) },
        ]
      : [
          { label: "Dies Added", value: num(v("dies_added")) },
          { label: "Active (All)", value: num(v("active")) },
          { label: "Discontinued", value: num(v("discontinued")) },
        ];
    case "micro": return [
      { label: "Plates", value: num(v("plates_today") || v("plates_month")) },
      { label: "Chemicals", value: num(v("chemicals_today") || v("chemicals_month")) },
      { label: "Films", value: num(v("films_today") || v("films_month")) },
    ];
    case "lamination": return [
      { label: period === "today" ? "Entries Today" : "Entries Month", value: num(v(period === "today" ? "entries_today" : "entries_month")) },
      { label: "Wt Received (kg)", value: (v(period === "today" ? "weight_received_today" : "weight_received_month")).toFixed(1) },
      { label: "Wt Issued (kg)", value: (v(period === "today" ? "weight_issued_today" : "weight_issued_month")).toFixed(1) },
    ];
    default: return [];
  }
}

function getDashKey(moduleKey: string, period: "today" | "month") {
  return `${moduleKey}${period === "today" ? "_today" : "_month"}`;
}

// ─── Global Search ────────────────────────────────────────────────────────────

const MODULE_COLORS: Record<string, string> = {
  "Paper": "bg-blue-50 text-blue-700 border-blue-200",
  "CTP Plates": "bg-purple-50 text-purple-700 border-purple-200",
  "Ink & Varnishes": "bg-pink-50 text-pink-700 border-pink-200",
  "Chemicals": "bg-green-50 text-green-700 border-green-200",
  "Adhesives": "bg-yellow-50 text-yellow-700 border-yellow-200",
  "Consumables": "bg-orange-50 text-orange-700 border-orange-200",
  "Packing Materials": "bg-teal-50 text-teal-700 border-teal-200",
  "Oil & Lubrication": "bg-amber-50 text-amber-700 border-amber-200",
  "Dies": "bg-red-50 text-red-700 border-red-200",
  "Micro Plates/Films": "bg-indigo-50 text-indigo-700 border-indigo-200",
};

const MODULE_EMOJIS: Record<string, string> = {
  "Paper": "📄", "CTP Plates": "🖨️", "Ink & Varnishes": "🎨",
  "Chemicals": "🧪", "Adhesives": "🏷️", "Consumables": "🔧",
  "Packing Materials": "📦", "Oil & Lubrication": "🛢️", "Dies": "✂️",
  "Micro Plates/Films": "🔬",
};

interface SearchResult { module: string; id: number; date: string; supplier: string; description: string; href: string; }

function GlobalSearchBar() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    clearTimeout(timerRef.current);
    if (!q.trim() || q.trim().length < 2) { setResults([]); setOpen(false); return; }
    timerRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await api.get("/api/analytics/global-search", { params: { q: q.trim() } });
        setResults(res.data);
        setOpen(true);
      } catch { setResults([]); }
      finally { setSearching(false); }
    }, 350);
    return () => clearTimeout(timerRef.current);
  }, [q]);

  return (
    <div ref={ref} className="relative w-full max-w-2xl">
      <div className="relative">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-taupe pointer-events-none" />
        <input
          type="text"
          placeholder="Search across all modules — supplier, item, GSM, die number…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          className="w-full rounded-2xl border-2 border-sand bg-white pl-11 pr-10 py-3 text-sm shadow-sm focus:outline-none focus:border-rust focus:ring-4 focus:ring-rust/10 transition-all"
        />
        {searching && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-rust border-t-transparent rounded-full animate-spin" />
        )}
        {q && !searching && (
          <button onClick={() => { setQ(""); setResults([]); setOpen(false); }}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-taupe hover:text-charcoal">
            <X size={15} />
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute z-50 top-full mt-2 w-full bg-white border border-sand rounded-2xl shadow-xl overflow-hidden">
          <p className="text-xs text-taupe px-4 pt-3 pb-1">{results.length} result{results.length !== 1 ? "s" : ""}</p>
          <div className="max-h-72 overflow-y-auto divide-y divide-sand/50">
            {results.map((r, i) => {
              const chipCls = MODULE_COLORS[r.module] || "bg-gray-50 text-gray-700 border-gray-200";
              return (
                <button key={i} onClick={() => { router.push(r.href); setOpen(false); setQ(""); }}
                  className="w-full text-left px-4 py-3 hover:bg-cream/60 transition-colors flex items-start gap-3">
                  <span className={`mt-0.5 shrink-0 text-xs font-medium px-2 py-0.5 rounded-full border ${chipCls}`}>
                    {r.module}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-charcoal font-medium truncate">{r.supplier}</p>
                    <p className="text-xs text-taupe truncate">{r.description}</p>
                  </div>
                  <span className="text-xs text-taupe shrink-0">{fmtDate(r.date)}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {open && q.trim().length >= 2 && results.length === 0 && !searching && (
        <div className="absolute z-50 top-full mt-2 w-full bg-white border border-sand rounded-2xl shadow-xl p-6 text-center">
          <p className="text-sm text-taupe">No results found for &ldquo;{q}&rdquo;</p>
        </div>
      )}
    </div>
  );
}

// ─── Recent Entries Sidebar ───────────────────────────────────────────────────

function RecentEntriesSidebar({
  entries,
}: {
  entries: { module: string; id: number; date: string; supplier: string; created_at: string; href: string }[];
}) {
  const top5 = entries.slice(0, 5);

  return (
    <div className="bg-white border-2 border-sand rounded-2xl overflow-hidden flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-sand">
        <Clock size={14} className="text-rust" />
        <h3 className="text-xs font-bold text-charcoal uppercase tracking-widest">Recent Entries</h3>
      </div>

      {/* Entries */}
      {top5.length === 0 ? (
        <div className="flex-1 flex items-center justify-center py-8">
          <p className="text-xs text-taupe text-center">No entries yet.</p>
        </div>
      ) : (
        <div className="divide-y divide-sand/50 flex-1">
          {top5.map((entry, i) => {
            const emoji = MODULE_EMOJIS[entry.module] || "📋";
            return (
              <Link key={i} href={entry.href}
                className="flex items-center gap-3 px-4 py-3 hover:bg-cream/60 transition-colors">
                <span className="text-xs font-medium text-rust tabular-nums shrink-0 w-16">
                  {fmtTime(entry.created_at)}
                </span>
                <span className="text-base leading-none shrink-0">{emoji}</span>
                <span className="text-xs font-medium text-charcoal truncate min-w-0">{entry.module}</span>
              </Link>
            );
          })}
        </div>
      )}

      {/* Footer */}
      <div className="px-4 py-3 border-t border-sand bg-cream/40">
        <Link href="/activity" className="text-xs text-rust font-medium hover:underline">
          View all activity →
        </Link>
      </div>
    </div>
  );
}

// ─── Skeleton loader ──────────────────────────────────────────────────────────

function CardSkeleton() {
  return <div className="bg-white border-2 border-sand rounded-2xl h-44 animate-pulse" />;
}

// ─── Outward Module Grid ──────────────────────────────────────────────────────

const OUTWARD_MODULES = [
  { title: "Paper",            emoji: "📄", href: "/paper-outward",     available: true },
  { title: "CTP Plates",       emoji: "🖨️", href: "/ctp-outward",       available: true },
  { title: "Ink & Varnishes",  emoji: "🎨", href: "/ink-outward",       available: true },
  { title: "Chemicals",        emoji: "🧪", href: "/chemicals-outward", available: true },
  { title: "Adhesives",        emoji: "🏷️", href: "/adhesives-outward", available: true },
  { title: "Consumables",      emoji: "🔧", href: "/consumables-outward", available: true },
  { title: "Packing Materials",emoji: "📦", href: "/packing-outward",   available: true },
  { title: "Oil & Lubrication",emoji: "🛢️", href: "/oil-outward",       available: true },
  { title: "DIES Movement",    emoji: "✂️", href: "/dies-outward",      available: true },
  { title: "Micro Plates/Films", emoji: "🔬", href: "/micro-outward",  available: true },
  { title: "Lamination Film",   emoji: "🎞️", href: "/lamination-outward", available: true },
];

function OutwardModuleGrid() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xs font-bold text-charcoal uppercase tracking-widest mb-1">Outward Modules</h2>
        <p className="text-sm text-taupe">Select a module to record outward transactions.</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {OUTWARD_MODULES.map((mod) => {
          const card = (
            <div className={`bg-white border-2 rounded-2xl p-5 h-full flex flex-col gap-3 transition-all ${
              mod.available
                ? "border-sand hover:border-rust hover:shadow-lg cursor-pointer group"
                : "border-sand opacity-50 cursor-not-allowed"
            }`}>
              <span className="text-3xl leading-none">{mod.emoji}</span>
              <div className="flex-1">
                <p className={`text-sm font-bold text-charcoal ${mod.available ? "group-hover:text-rust transition-colors" : ""}`}>
                  {mod.title}
                </p>
                {!mod.available && (
                  <p className="text-xs text-taupe mt-0.5">Coming soon</p>
                )}
              </div>
              <div className={`w-2 h-2 rounded-full ${mod.available ? "bg-sand group-hover:bg-rust transition-colors" : "bg-sand/40"}`} />
            </div>
          );

          return mod.available ? (
            <Link key={mod.title} href={mod.href} className="block h-full">
              {card}
            </Link>
          ) : (
            <div key={mod.title} className="h-full">
              {card}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [mode, setMode] = useState<"inward" | "outward">("inward");
  const [stats, setStats] = useState<Record<string, Record<string, number | Record<string, number>>>>({});
  const [recent, setRecent] = useState<{ module: string; id: number; date: string; supplier: string; created_at: string; href: string }[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  const fetchData = useCallback(async () => {
    if (!user) return;
    try {
      const [dashRes, recentRes] = await Promise.all([
        api.get("/api/analytics/dashboard"),
        api.get("/api/analytics/recent", { params: { limit: 5 } }),
      ]);
      setStats(dashRes.data);
      setRecent(recentRes.data);
    } catch { /* ignore */ }
    finally { setLoadingStats(false); }
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading || !user) {
    return <div className="min-h-screen flex items-center justify-center bg-cream"><p className="text-taupe">Loading...</p></div>;
  }

  const todayLabel = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  const monthLabel = new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  return (
    <div className="min-h-screen bg-cream">
      <AppHeader title="Dashboard" />

      <main className="max-w-screen-xl mx-auto px-6 py-8 space-y-8">

        {user.role === "admin" && (
          <div className="flex justify-end gap-2">
            <Link href="/admin/users"
              className="inline-flex items-center gap-1.5 text-xs text-taupe hover:text-charcoal border border-sand bg-white rounded-xl px-3 py-2 transition-colors">
              👥 Manage Users
            </Link>
            <Link href="/admin/settings"
              className="inline-flex items-center gap-1.5 text-xs text-taupe hover:text-charcoal border border-sand bg-white rounded-xl px-3 py-2 transition-colors">
              ⚙️ Admin Settings
            </Link>
          </div>
        )}

        {/* ── INWARD / OUTWARD toggle ── */}
        <div className="flex items-center gap-1 bg-white border border-sand rounded-2xl p-1 w-fit">
          <button
            onClick={() => setMode("inward")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              mode === "inward"
                ? "bg-rust text-white shadow-sm"
                : "text-taupe hover:text-charcoal"
            }`}
          >
            <ArrowDownToLine size={15} />INWARD
          </button>
          <button
            onClick={() => setMode("outward")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              mode === "outward"
                ? "bg-rust text-white shadow-sm"
                : "text-taupe hover:text-charcoal"
            }`}
          >
            <ArrowUpFromLine size={15} />OUTWARD
          </button>
        </div>

        {/* ── Outward mode ── */}
        {mode === "outward" && <OutwardModuleGrid />}

        {/* ── Inward mode content ── */}
        {mode === "inward" && (
        <>

        {/* ── Search bar ── */}
        <div className="flex items-center gap-4">
          <GlobalSearchBar />
        </div>

        {/* ── Today's Activity + Recent Entries sidebar ── */}
        <section>
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">

            {/* Analytics panel — Today */}
            <div className="lg:col-span-3">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp size={15} className="text-rust" />
                <h2 className="text-xs font-bold text-charcoal uppercase tracking-widest">Today&apos;s Activity</h2>
                <span className="text-xs text-taupe">{todayLabel}</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {loadingStats
                  ? Array.from({ length: 9 }).map((_, i) => <CardSkeleton key={i} />)
                  : MODULES.map((mod) => {
                      const data = (stats[getDashKey(mod.key, "today")] as Record<string, number | Record<string, number>>) ?? {};
                      return <ModuleAnalyticsCard key={mod.key} mod={mod} data={data} period="today" />;
                    })}
              </div>
            </div>

            {/* Recent Entries sidebar */}
            <div className="lg:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <Clock size={15} className="text-rust" />
                <h2 className="text-xs font-bold text-charcoal uppercase tracking-widest">Recent</h2>
              </div>
              <RecentEntriesSidebar entries={recent} />
            </div>

          </div>
        </section>

        {/* ── This Month's Activity ── */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <CalendarDays size={15} className="text-rust" />
            <h2 className="text-xs font-bold text-charcoal uppercase tracking-widest">This Month&apos;s Activity</h2>
            <span className="text-xs text-taupe">{monthLabel}</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {loadingStats
              ? Array.from({ length: 9 }).map((_, i) => <CardSkeleton key={i} />)
              : MODULES.map((mod) => {
                  const data = (stats[getDashKey(mod.key, "month")] as Record<string, number | Record<string, number>>) ?? {};
                  return <ModuleAnalyticsCard key={mod.key} mod={mod} data={data} period="month" />;
                })}
          </div>
        </section>

        </> /* end inward mode */ )}

      </main>
    </div>
  );
}
