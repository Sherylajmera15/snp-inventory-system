"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import AppHeader from "@/components/AppHeader";
import api from "@/lib/api";
import { AlertTriangle, Pencil, Trash2, X } from "lucide-react";
import { isWithin24Hours } from "@/components/EditProtectionModal";

interface OilDetail {
  id: number; outward_date: string; outward_time: string | null;
  machine_name: string | null; issued_by: string | null; received_by: string | null; remarks: string | null;
  created_by_id: number | null; created_by_name: string | null;
  items: { id: number; item_name: string; quantity_issued: number; unit: string }[];
  adjustments: { id: number; item_name: string; quantity: number; unit: string; reason: string | null }[];
}

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div>
      <p className="text-xs text-taupe font-medium mb-0.5">{label}</p>
      <p className="text-sm text-charcoal font-semibold">{value ?? "—"}</p>
    </div>
  );
}

export default function OilOutwardDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, loading } = useAuth();
  const router = useRouter();
  const [entry, setEntry] = useState<OilDetail | null>(null);
  const [fetching, setFetching] = useState(true);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState<{ outward_date: string; outward_time: string; machine_name: string; issued_by: string; received_by: string; remarks: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => { if (!loading && !user) router.replace("/login"); }, [user, loading, router]);
  useEffect(() => {
    if (!user) return;
    api.get(`/api/oil-outward/${id}`).then((r) => setEntry(r.data)).finally(() => setFetching(false));
  }, [user, id]);

  async function handleDelete() {
    if (!password.trim()) { setDeleteError("Password is required."); return; }
    setDeleting(true); setDeleteError("");
    try {
      await api.delete(`/api/oil-outward/${id}`, { data: { password } });
      router.push("/oil-outward");
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setDeleteError(msg || "Delete failed. Check your password.");
    } finally { setDeleting(false); }
  }

  function toDateInput(s: string) { try { return new Date(s).toISOString().slice(0, 10); } catch { return s; } }

  function startEdit() {
    if (!entry) return;
    setEditData({
      outward_date: toDateInput(entry.outward_date),
      outward_time: entry.outward_time ? String(entry.outward_time).slice(0, 5) : "",
      machine_name: entry.machine_name || "",
      issued_by: entry.issued_by || "",
      received_by: entry.received_by || "",
      remarks: entry.remarks || "",
    });
    setEditMode(true);
  }

  async function handleSave() {
    if (!editData) return;
    setSaving(true); setSaveError("");
    try {
      const res = await api.put(`/api/oil-outward/${id}`, { ...editData, outward_time: editData.outward_time || null });
      setEntry((prev) => prev ? { ...prev, ...res.data } : prev);
      setEditMode(false);
    } catch (e: any) { setSaveError(e.response?.data?.detail ?? "Failed to save."); }
    finally { setSaving(false); }
  }

  function cancelEdit() { setEditMode(false); setEditData(null); setSaveError(""); }

  if (loading || !user || fetching) return <div className="min-h-screen flex items-center justify-center bg-cream"><p className="text-taupe">Loading...</p></div>;
  if (!entry) return <div className="min-h-screen flex items-center justify-center bg-cream"><p className="text-taupe">Entry not found.</p></div>;

  const dateStr = toDateInput(entry.outward_date);
  const timeStr = entry.outward_time ? String(entry.outward_time).slice(0, 5) : null;
  const within24 = isWithin24Hours(dateStr, timeStr);
  const canEdit = user.role === "admin" || (entry.created_by_id === user.id && within24);

  return (
    <div className="min-h-screen bg-cream">
      <AppHeader title="Oil & Lubrication Outward" backHref="/oil-outward" />
      <main className="max-w-3xl mx-auto px-6 py-10 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-charcoal">🛢️ Outward Entry #{entry.id}</h1>
          <div className="flex items-center gap-2">
            {!editMode ? (
              <>
                {canEdit && (
                  <button onClick={startEdit} className="flex items-center gap-1.5 border border-sand bg-white text-charcoal rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-cream transition-colors">
                    <Pencil size={12} /> Edit
                  </button>
                )}
                {user.role === "admin" && (
                  <button onClick={() => setDeleteOpen(true)} className="inline-flex items-center gap-2 border border-red-200 text-red-500 rounded-xl px-4 py-2 text-sm font-medium hover:bg-red-50 transition-colors">
                    <Trash2 size={14} /> Delete
                  </button>
                )}
              </>
            ) : (
              <>
                <button onClick={cancelEdit} className="flex items-center gap-1 border border-sand bg-white text-charcoal rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-cream transition-colors"><X size={12} />Cancel</button>
                <button onClick={handleSave} disabled={saving} className="bg-rust text-white rounded-lg px-3 py-1.5 text-xs font-semibold hover:bg-rust/90 disabled:opacity-50 transition-colors">{saving ? "Saving…" : "Save"}</button>
              </>
            )}
          </div>
        </div>

        {editMode && editData ? (
          <div className="bg-white border border-sand rounded-2xl p-6 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-xs font-medium text-taupe mb-1">Date</label><input type="date" value={editData.outward_date} onChange={(e) => setEditData({ ...editData, outward_date: e.target.value })} className="w-full rounded-xl border border-sand bg-cream/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust" /></div>
              <div><label className="block text-xs font-medium text-taupe mb-1">Time</label><input type="time" value={editData.outward_time} onChange={(e) => setEditData({ ...editData, outward_time: e.target.value })} className="w-full rounded-xl border border-sand bg-cream/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust" /></div>
            </div>
            <div><label className="block text-xs font-medium text-taupe mb-1">Machine Name</label><input type="text" value={editData.machine_name} onChange={(e) => setEditData({ ...editData, machine_name: e.target.value })} className="w-full rounded-xl border border-sand bg-cream/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-xs font-medium text-taupe mb-1">Issued By</label><input type="text" value={editData.issued_by} onChange={(e) => setEditData({ ...editData, issued_by: e.target.value })} className="w-full rounded-xl border border-sand bg-cream/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust" /></div>
              <div><label className="block text-xs font-medium text-taupe mb-1">Received By</label><input type="text" value={editData.received_by} onChange={(e) => setEditData({ ...editData, received_by: e.target.value })} className="w-full rounded-xl border border-sand bg-cream/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust" /></div>
            </div>
            <div><label className="block text-xs font-medium text-taupe mb-1">Remarks</label><textarea value={editData.remarks} rows={2} onChange={(e) => setEditData({ ...editData, remarks: e.target.value })} className="w-full rounded-xl border border-sand bg-cream/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust resize-none" /></div>
            {saveError && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{saveError}</p>}
          </div>
        ) : (
          <div className="bg-white border border-sand rounded-2xl p-6 grid grid-cols-2 md:grid-cols-3 gap-5">
            <Field label="Date" value={new Date(entry.outward_date).toLocaleDateString("en-GB")} />
            <Field label="Time" value={timeStr} />
            <Field label="Machine" value={entry.machine_name} />
            <Field label="Issued By" value={entry.issued_by} />
            <Field label="Received By" value={entry.received_by} />
            <Field label="Created By" value={entry.created_by_name} />
            {entry.remarks && <div className="col-span-2 md:col-span-3"><Field label="Remarks" value={entry.remarks} /></div>}
          </div>
        )}

        <div className="bg-white border border-sand rounded-2xl p-6 space-y-4">
          <h2 className="text-sm font-bold text-charcoal uppercase tracking-widest">Items Issued</h2>
          {entry.items.length === 0
            ? <p className="text-sm text-taupe">No items recorded.</p>
            : (
              <div className="space-y-2">
                {entry.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between bg-cream/60 rounded-xl px-4 py-3">
                    <p className="text-sm font-medium text-charcoal">{item.item_name}</p>
                    <p className="text-sm font-bold text-charcoal ml-4 shrink-0">{item.quantity_issued} {item.unit}</p>
                  </div>
                ))}
              </div>
            )}
        </div>

        {entry.adjustments.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-amber-600" />
              <h2 className="text-sm font-bold text-amber-900 uppercase tracking-widest">Adjustment Entries</h2>
            </div>
            <div className="space-y-2">
              {entry.adjustments.map((adj) => (
                <div key={adj.id} className="bg-white border border-amber-200 rounded-xl px-4 py-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-charcoal">{adj.item_name}</p>
                    <p className="text-sm font-bold text-amber-700 ml-4 shrink-0">+{adj.quantity} {adj.unit}</p>
                  </div>
                  {adj.reason && <p className="text-xs text-taupe">{adj.reason}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {deleteOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-red-50 rounded-xl p-2"><Trash2 size={18} className="text-red-500" /></div>
              <div><h2 className="text-base font-bold text-charcoal">Delete Entry</h2><p className="text-xs text-taupe">This action cannot be undone.</p></div>
            </div>
            <div className="mb-4">
              <label className="block text-xs font-medium text-taupe mb-1.5">Admin Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter password" autoFocus
                className="w-full rounded-xl border border-sand bg-cream/40 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust" />
              {deleteError && <p className="text-xs text-red-500 mt-1">{deleteError}</p>}
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setDeleteOpen(false); setPassword(""); setDeleteError(""); }} className="flex-1 border border-sand bg-white text-charcoal rounded-xl py-2.5 text-sm font-medium hover:bg-cream transition-colors">Cancel</button>
              <button onClick={handleDelete} disabled={deleting} className="flex-1 bg-red-500 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-red-600 disabled:opacity-50 transition-colors">
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
