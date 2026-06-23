"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import AppHeader from "@/components/AppHeader";
import api from "@/lib/api";
import {
  MicroPlatesOutwardListItem,
  MicroFilmsOutwardListItem,
  MicroChemicalsOutwardListItem,
} from "@/types/micro";
import { Plus } from "lucide-react";

type TabKey = "plates" | "chemicals" | "films";

function PlatesOutwardTable({
  entries,
  onRowClick,
}: {
  entries: MicroPlatesOutwardListItem[];
  onRowClick: (id: number) => void;
}) {
  if (entries.length === 0) {
    return (
      <div className="bg-white border border-sand rounded-2xl p-12 text-center">
        <p className="text-taupe">No plates outward entries yet.</p>
      </div>
    );
  }
  return (
    <div className="bg-white border border-sand rounded-2xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-cream text-left text-taupe text-xs uppercase tracking-wide">
            <th className="px-5 py-3 font-medium">Date</th>
            <th className="px-5 py-3 font-medium">Time</th>
            <th className="px-5 py-3 font-medium">Plate Size</th>
            <th className="px-5 py-3 font-medium">No. of Plates</th>
            <th className="px-5 py-3 font-medium">Issued By</th>
            <th className="px-5 py-3 font-medium">Receiver</th>
            <th className="px-5 py-3 font-medium">Remarks</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr
              key={e.id}
              onClick={() => onRowClick(e.id)}
              className="border-t border-sand hover:bg-cream/60 cursor-pointer transition-colors"
            >
              <td className="px-5 py-3 text-charcoal font-medium">
                {new Date(e.outward_date).toLocaleDateString("en-GB")}
              </td>
              <td className="px-5 py-3 text-charcoal">{e.outward_time?.slice(0, 5) || "—"}</td>
              <td className="px-5 py-3 text-charcoal">{e.plate_size}</td>
              <td className="px-5 py-3 text-charcoal font-semibold">{e.number_of_plates}</td>
              <td className="px-5 py-3 text-charcoal">{e.issued_by || "—"}</td>
              <td className="px-5 py-3 text-charcoal">{e.receiver_name || "—"}</td>
              <td className="px-5 py-3 text-taupe">{e.remarks || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ChemicalsOutwardTable({
  entries,
  onRowClick,
}: {
  entries: MicroChemicalsOutwardListItem[];
  onRowClick: (id: number) => void;
}) {
  if (entries.length === 0) {
    return (
      <div className="bg-white border border-sand rounded-2xl p-12 text-center">
        <p className="text-taupe">No chemicals outward entries yet.</p>
      </div>
    );
  }
  return (
    <div className="bg-white border border-sand rounded-2xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-cream text-left text-taupe text-xs uppercase tracking-wide">
            <th className="px-5 py-3 font-medium">Date</th>
            <th className="px-5 py-3 font-medium">Time</th>
            <th className="px-5 py-3 font-medium">Items</th>
            <th className="px-5 py-3 font-medium">Issued By</th>
            <th className="px-5 py-3 font-medium">Received By</th>
            <th className="px-5 py-3 font-medium">Remarks</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr
              key={e.id}
              onClick={() => onRowClick(e.id)}
              className="border-t border-sand hover:bg-cream/60 cursor-pointer transition-colors"
            >
              <td className="px-5 py-3 text-charcoal font-medium">
                {new Date(e.outward_date).toLocaleDateString("en-GB")}
              </td>
              <td className="px-5 py-3 text-charcoal">{e.outward_time?.slice(0, 5) || "—"}</td>
              <td className="px-5 py-3 text-charcoal">
                {e.items?.map((it) => `${it.item_name} (${it.quantity_issued} ${it.unit})`).join(", ") || "—"}
              </td>
              <td className="px-5 py-3 text-charcoal">{e.issued_by || "—"}</td>
              <td className="px-5 py-3 text-charcoal">{e.received_by || "—"}</td>
              <td className="px-5 py-3 text-taupe">{e.remarks || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FilmsOutwardTable({
  entries,
  onRowClick,
}: {
  entries: MicroFilmsOutwardListItem[];
  onRowClick: (id: number) => void;
}) {
  if (entries.length === 0) {
    return (
      <div className="bg-white border border-sand rounded-2xl p-12 text-center">
        <p className="text-taupe">No films outward entries yet.</p>
      </div>
    );
  }
  return (
    <div className="bg-white border border-sand rounded-2xl overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-cream text-left text-taupe text-xs uppercase tracking-wide">
            <th className="px-5 py-3 font-medium">Date</th>
            <th className="px-5 py-3 font-medium">Time</th>
            <th className="px-5 py-3 font-medium">Job Name</th>
            <th className="px-5 py-3 font-medium">L × W (mm)</th>
            <th className="px-5 py-3 font-medium">Film Type</th>
            <th className="px-5 py-3 font-medium">Qty</th>
            <th className="px-5 py-3 font-medium">Issued By</th>
            <th className="px-5 py-3 font-medium">Remarks</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr
              key={e.id}
              onClick={() => onRowClick(e.id)}
              className="border-t border-sand hover:bg-cream/60 cursor-pointer transition-colors"
            >
              <td className="px-5 py-3 text-charcoal font-medium">
                {new Date(e.outward_date).toLocaleDateString("en-GB")}
              </td>
              <td className="px-5 py-3 text-charcoal">{e.outward_time?.slice(0, 5) || "—"}</td>
              <td className="px-5 py-3 text-charcoal">{e.job_name}</td>
              <td className="px-5 py-3 text-charcoal">
                {(e.film_length || e.film_width) ? `${e.film_length ?? "?"} × ${e.film_width ?? "?"}` : "—"}
              </td>
              <td className="px-5 py-3">
                {e.film_type ? (
                  <span className="text-xs bg-purple-50 text-purple-700 border border-purple-200 rounded-full px-2 py-0.5">
                    {e.film_type}
                  </span>
                ) : "—"}
              </td>
              <td className="px-5 py-3 text-charcoal font-semibold">{e.quantity ?? "—"}</td>
              <td className="px-5 py-3 text-charcoal">{e.issued_by || "—"}</td>
              <td className="px-5 py-3 text-taupe">{e.remarks || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function MicroOutwardHubPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("plates");

  const [plateEntries, setPlateEntries] = useState<MicroPlatesOutwardListItem[]>([]);
  const [chemEntries, setChemEntries] = useState<MicroChemicalsOutwardListItem[]>([]);
  const [filmEntries, setFilmEntries] = useState<MicroFilmsOutwardListItem[]>([]);
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  const fetchAll = useCallback(async () => {
    if (!user) return;
    setFetching(true);
    try {
      const [platesRes, chemsRes, filmsRes] = await Promise.all([
        api.get("/api/micro-plates-outward"),
        api.get("/api/micro-chemicals-outward"),
        api.get("/api/micro-films-outward"),
      ]);
      setPlateEntries(platesRes.data);
      setChemEntries(chemsRes.data);
      setFilmEntries(filmsRes.data);
    } catch {
      // ignore
    } finally {
      setFetching(false);
    }
  }, [user]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream">
        <p className="text-taupe">Loading...</p>
      </div>
    );
  }

  const TAB_CONFIG: { key: TabKey; label: string; newHref: string }[] = [
    { key: "plates", label: "Plates", newHref: "/micro-outward/plates/new" },
    { key: "chemicals", label: "Chemicals", newHref: "/micro-outward/chemicals/new" },
    { key: "films", label: "Films", newHref: "/micro-outward/films/new" },
  ];

  const currentConfig = TAB_CONFIG.find((t) => t.key === tab)!;

  return (
    <div className="min-h-screen bg-cream">
      <AppHeader title="Micro Outward" backHref="/dashboard" />
      <main className="max-w-6xl mx-auto px-6 py-10">

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-xl font-semibold text-charcoal">Micro Outward Entries</h2>
            <p className="text-sm text-taupe">Manage plates, chemicals, and films outward transactions.</p>
          </div>
          <Link
            href={currentConfig.newHref}
            className="inline-flex items-center gap-2 bg-rust text-white rounded-lg px-4 py-2.5 text-sm font-medium hover:bg-rust/90 transition-colors"
          >
            <Plus size={16} />New {currentConfig.label} Outward
          </Link>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-white border border-sand rounded-2xl p-1 w-fit mb-6">
          {TAB_CONFIG.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                tab === t.key
                  ? "bg-rust text-white shadow-sm"
                  : "text-taupe hover:text-charcoal"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {fetching ? (
          <p className="text-sm text-taupe">Loading entries...</p>
        ) : (
          <>
            {tab === "plates" && (
              <PlatesOutwardTable
                entries={plateEntries}
                onRowClick={(id) => router.push(`/micro-outward/plates/${id}`)}
              />
            )}
            {tab === "chemicals" && (
              <ChemicalsOutwardTable
                entries={chemEntries}
                onRowClick={(id) => router.push(`/micro-outward/chemicals/${id}`)}
              />
            )}
            {tab === "films" && (
              <FilmsOutwardTable
                entries={filmEntries}
                onRowClick={(id) => router.push(`/micro-outward/films/${id}`)}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}
