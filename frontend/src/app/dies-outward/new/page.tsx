"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import AppHeader from "@/components/AppHeader";
import api from "@/lib/api";
import { ActiveDie } from "@/types/die-movement";
import { CheckCircle, Search } from "lucide-react";
import { IssuedByInput, ReceivedByInput } from "@/components/AutocompleteInput";

function DieCard({ die, selected, onClick }: { die: ActiveDie; selected: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className={`w-full text-left rounded-xl border px-4 py-3 transition-colors ${selected ? "border-rust bg-rust/5" : "border-sand bg-white hover:bg-cream/60"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-bold text-charcoal">{die.die_number}</p>
          <p className="text-xs text-taupe mt-0.5 truncate">{die.job_name}</p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            <span className="text-xs bg-cream rounded-full px-2 py-0.5 text-charcoal">UPS: {die.ups}</span>
            {die.embossing && die.embossing !== "None" && <span className="text-xs bg-cream rounded-full px-2 py-0.5 text-charcoal">Embossing: {die.embossing}</span>}
            {die.rubberized && die.rubberized !== "No" && <span className="text-xs bg-cream rounded-full px-2 py-0.5 text-charcoal">Rubberized</span>}
            {die.storage_location && <span className="text-xs bg-cream rounded-full px-2 py-0.5 text-charcoal">📍 {die.storage_location}</span>}
          </div>
        </div>
        {selected && <CheckCircle size={18} className="text-rust shrink-0 mt-0.5" />}
      </div>
    </button>
  );
}

export default function DiesOutwardNewPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);
  const nowTime = new Date().toTimeString().slice(0, 5);

  const [dieQuery, setDieQuery] = useState("");
  const [dies, setDies] = useState<ActiveDie[]>([]);
  const [dieLoading, setDieLoading] = useState(false);
  const [selectedDie, setSelectedDie] = useState<ActiveDie | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [movementDate, setMovementDate] = useState(today);
  const [movementTime, setMovementTime] = useState(nowTime);
  const [issuedTo, setIssuedTo] = useState("");
  const [currentLocation, setCurrentLocation] = useState("");
  const [issuedBy, setIssuedBy] = useState("");
  const [receivedBy, setReceivedBy] = useState("");
  const [remarks, setRemarks] = useState("");

  useEffect(() => { if (!loading && !user) router.replace("/login"); }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    setDieLoading(true);
    const q = dieQuery.trim() ? `?q=${encodeURIComponent(dieQuery)}` : "";
    api.get(`/api/die-movement/active-dies${q}`).then((r) => setDies(r.data)).finally(() => setDieLoading(false));
  }, [user, dieQuery]);

  async function handleSubmit() {
    if (!selectedDie) { setError("Please select a die."); return; }
    if (!issuedTo.trim()) { setError("Issued To is required."); return; }
    setError(""); setSubmitting(true);
    try {
      await api.post("/api/die-movement", {
        movement_date: movementDate, movement_time: movementTime || null,
        die_item_id: selectedDie.id, issued_to: issuedTo.trim(),
        current_location: currentLocation.trim() || null,
        issued_by: issuedBy.trim() || null, received_by: receivedBy.trim() || null,
        remarks: remarks.trim() || null,
      });
      router.push("/dies-outward");
    } catch {
      setError("Failed to save. Please try again.");
    } finally { setSubmitting(false); }
  }

  if (loading || !user) return <div className="min-h-screen flex items-center justify-center bg-cream"><p className="text-taupe">Loading...</p></div>;

  return (
    <div className="min-h-screen bg-cream">
      <AppHeader title="Record New Die Movement" backHref="/dies-outward" />
      <main className="max-w-3xl mx-auto px-6 py-10 space-y-6">
        <div className="bg-white border border-sand rounded-2xl p-6 space-y-4">
          <h2 className="text-sm font-bold text-charcoal uppercase tracking-widest">Movement Details</h2>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-xs font-medium text-taupe mb-1.5">Date</label>
              <input type="date" value={movementDate} onChange={(e) => setMovementDate(e.target.value)} className="w-full rounded-xl border border-sand bg-cream/40 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust" /></div>
            <div><label className="block text-xs font-medium text-taupe mb-1.5">Time</label>
              <input type="time" value={movementTime} onChange={(e) => setMovementTime(e.target.value)} className="w-full rounded-xl border border-sand bg-cream/40 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust" /></div>
          </div>
          <div><label className="block text-xs font-medium text-taupe mb-1.5">Issued To <span className="text-red-400">*</span></label>
            <input type="text" value={issuedTo} onChange={(e) => setIssuedTo(e.target.value)} placeholder="Person or department the die is issued to"
              className="w-full rounded-xl border border-sand bg-cream/40 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust" /></div>
          <div><label className="block text-xs font-medium text-taupe mb-1.5">Current Location (Optional)</label>
            <input type="text" value={currentLocation} onChange={(e) => setCurrentLocation(e.target.value)} placeholder="Where is the die currently? e.g. Die Cutting Department, Rack A"
              className="w-full rounded-xl border border-sand bg-cream/40 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-taupe mb-1.5">Issued By</label>
              <IssuedByInput value={issuedBy} onChange={setIssuedBy} />
            </div>
            <div>
              <label className="block text-xs font-medium text-taupe mb-1.5">Received By</label>
              <ReceivedByInput value={receivedBy} onChange={setReceivedBy} />
            </div>
          </div>
          <div><label className="block text-xs font-medium text-taupe mb-1.5">Remarks (Optional)</label>
            <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} placeholder="Any additional notes…"
              className="w-full rounded-xl border border-sand bg-cream/40 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust resize-none" /></div>
        </div>

        <div className="space-y-4">
          <h2 className="text-sm font-bold text-charcoal uppercase tracking-widest">Select Die</h2>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-taupe pointer-events-none" />
            <input type="text" placeholder="Search by die number or job name…" value={dieQuery} onChange={(e) => setDieQuery(e.target.value)}
              className="w-full rounded-xl border border-sand bg-white pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust" />
          </div>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {dieLoading && <p className="text-xs text-taupe text-center py-4">Loading dies…</p>}
            {!dieLoading && dies.length === 0 && <p className="text-xs text-taupe text-center py-4">{dieQuery ? "No dies match your search." : "No active dies found."}</p>}
            {!dieLoading && dies.map((die) => (
              <DieCard key={die.id} die={die} selected={selectedDie?.id === die.id} onClick={() => setSelectedDie(die)} />
            ))}
          </div>
        </div>

        {error && <p className="text-xs text-red-500 text-center">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={() => router.push("/dies-outward")} className="flex-1 border border-sand bg-white text-charcoal rounded-xl py-3 text-sm font-medium hover:bg-cream transition-colors">Cancel</button>
          <button type="button" onClick={handleSubmit} disabled={submitting || !selectedDie || !issuedTo.trim()}
            className="flex-1 bg-rust text-white rounded-xl py-3 text-sm font-semibold hover:bg-rust/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            {submitting ? "Saving…" : "Record Movement"}
          </button>
        </div>
      </main>
    </div>
  );
}
