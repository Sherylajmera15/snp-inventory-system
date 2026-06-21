"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import AppHeader from "@/components/AppHeader";
import api from "@/lib/api";
import { CTPOutwardDetail } from "@/types/ctp-outward";
import { Pencil, Trash2, X } from "lucide-react";
import { isWithin24Hours } from "@/components/EditProtectionModal";

function DeleteModal({
  onConfirm, onCancel, error,
}: { onConfirm: (pw: string) => void; onCancel: () => void; error: string }) {
  const [pw, setPw] = useState("");
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4">
        <h2 className="text-base font-bold text-charcoal">Delete CTP Outward Entry</h2>
        <p className="text-sm text-taupe">Enter your admin password to confirm deletion.</p>
        <input type="password" placeholder="Admin password" value={pw} onChange={(e) => setPw(e.target.value)}
          className="w-full rounded-lg border border-sand bg-cream/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust" />
        {error && <p className="text-xs text-red-500">{error}</p>}
        <div className="flex gap-3 pt-1">
          <button onClick={onCancel} className="flex-1 border border-sand text-charcoal rounded-xl py-2.5 text-sm font-medium hover:bg-cream transition-colors">Cancel</button>
          <button onClick={() => onConfirm(pw)} disabled={!pw} className="flex-1 bg-red-500 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-red-600 disabled:opacity-50 transition-colors">Delete</button>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-taupe uppercase tracking-wide font-semibold">{label}</span>
      <span className="text-sm text-charcoal">{value || "—"}</span>
    </div>
  );
}

export default function CTPOutwardDetailPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const [detail, setDetail] = useState<CTPOutwardDetail | null>(null);
  const [fetching, setFetching] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState<{ outward_date: string; outward_time: string; issued_by: string; received_by: string; remarks: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    if (!loading && !user) { router.replace("/login"); return; }
    if (!user) return;
    api.get(`/api/ctp-outward/${id}`)
      .then((r) => setDetail(r.data))
      .catch(() => setNotFound(true))
      .finally(() => setFetching(false));
  }, [user, loading, id, router]);

  const handleDelete = async (password: string) => {
    setDeleteError("");
    try {
      await api.delete(`/api/ctp-outward/${id}`, { data: { password } });
      router.replace("/ctp-outward");
    } catch (e: unknown) { setDeleteError((e as { response?: { data?: { detail?: string } } }).response?.data?.detail ?? "Failed to delete."); }
  };

  if (loading || (!detail && fetching)) {
    return (
      <div className="min-h-screen bg-cream">
        <AppHeader title="CTP Outward Detail" backHref="/ctp-outward" />
        <div className="flex items-center justify-center py-32"><p className="text-taupe">Loading…</p></div>
      </div>
    );
  }

  if (notFound || !detail) {
    return (
      <div className="min-h-screen bg-cream">
        <AppHeader title="CTP Outward Detail" backHref="/ctp-outward" />
        <div className="flex items-center justify-center py-32"><p className="text-taupe">Entry not found.</p></div>
      </div>
    );
  }

  function toDateInput(s: string) { try { return new Date(s).toISOString().slice(0, 10); } catch { return s; } }

  function startEdit() {
    if (!detail) return;
    setEditData({
      outward_date: toDateInput(detail.outward_date),
      outward_time: detail.outward_time ? String(detail.outward_time).slice(0, 5) : "",
      issued_by: detail.issued_by || "",
      received_by: detail.received_by || "",
      remarks: detail.remarks || "",
    });
    setEditMode(true);
  }

  async function handleSave() {
    if (!editData) return;
    setSaving(true); setSaveError("");
    try {
      const res = await api.put(`/api/ctp-outward/${id}`, { ...editData, outward_time: editData.outward_time || null });
      setDetail((prev) => prev ? { ...prev, ...res.data } : prev);
      setEditMode(false);
    } catch (e: unknown) { setSaveError((e as { response?: { data?: { detail?: string } } }).response?.data?.detail ?? "Failed to save."); }
    finally { setSaving(false); }
  }

  function cancelEdit() { setEditMode(false); setEditData(null); setSaveError(""); }

  const dateLabel = new Date(detail.outward_date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const timeLabel = detail.outward_time ? String(detail.outward_time).slice(0, 5) : null;
  const totalPlates = detail.items.reduce((s, i) => s + i.quantity_issued, 0);
  const within24 = isWithin24Hours(toDateInput(detail.outward_date), detail.outward_time ? String(detail.outward_time).slice(0, 5) : null);
  const canEdit = user?.role === "admin" || (
    detail.created_by_id === user?.id && within24
  );

  return (
    <div className="min-h-screen bg-cream">
      <AppHeader title="CTP Outward Detail" backHref="/ctp-outward" />
      <main className="max-w-3xl mx-auto px-6 py-10 space-y-6">

        <div className="bg-white border border-sand rounded-2xl p-6 space-y-5">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-lg font-bold text-charcoal">CTP Outward #{detail.id}</h1>
              <p className="text-sm text-taupe">{dateLabel}{timeLabel ? ` · ${timeLabel}` : ""}</p>
            </div>
            <div className="flex items-center gap-2">
              {!editMode ? (
                <>
                  {canEdit && (
                    <button onClick={startEdit} className="flex items-center gap-1.5 border border-sand bg-white text-charcoal rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-cream transition-colors"><Pencil size={12} />Edit</button>
                  )}
                  {user?.role === "admin" && (
                    <button onClick={() => setShowDelete(true)} className="inline-flex items-center gap-1.5 border border-red-200 text-red-500 rounded-lg px-3 py-2 text-sm font-medium hover:bg-red-50 transition-colors"><Trash2 size={14} />Delete</button>
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
            <div className="space-y-3 pt-1">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-taupe mb-1">Date</label><input type="date" value={editData.outward_date} onChange={(e) => setEditData({ ...editData, outward_date: e.target.value })} className="w-full rounded-xl border border-sand bg-cream/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust" /></div>
                <div><label className="block text-xs font-medium text-taupe mb-1">Time</label><input type="time" value={editData.outward_time} onChange={(e) => setEditData({ ...editData, outward_time: e.target.value })} className="w-full rounded-xl border border-sand bg-cream/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-taupe mb-1">Issued By</label><input type="text" value={editData.issued_by} onChange={(e) => setEditData({ ...editData, issued_by: e.target.value })} className="w-full rounded-xl border border-sand bg-cream/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust" /></div>
                <div><label className="block text-xs font-medium text-taupe mb-1">Received By</label><input type="text" value={editData.received_by} onChange={(e) => setEditData({ ...editData, received_by: e.target.value })} className="w-full rounded-xl border border-sand bg-cream/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust" /></div>
              </div>
              <div><label className="block text-xs font-medium text-taupe mb-1">Remarks</label><textarea value={editData.remarks} rows={2} onChange={(e) => setEditData({ ...editData, remarks: e.target.value })} className="w-full rounded-xl border border-sand bg-cream/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust resize-none" /></div>
              {saveError && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{saveError}</p>}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-1">
              <InfoRow label="Issued By" value={detail.issued_by} />
              <InfoRow label="Received By" value={detail.received_by} />
              <InfoRow label="Created By" value={detail.created_by_name} />
              <InfoRow label="Remarks" value={detail.remarks} />
            </div>
          )}
        </div>

        <div className="bg-white border border-sand rounded-2xl p-6 space-y-3">
          <h2 className="text-sm font-semibold text-charcoal">Plates Issued</h2>
          <div className="divide-y divide-sand">
            {detail.items.map((item) => (
              <div key={item.id} className="flex items-center justify-between py-3">
                <p className="text-sm font-semibold text-charcoal">{item.plate_size}</p>
                <span className="text-sm text-charcoal bg-rust/10 rounded-full px-3 py-0.5 font-semibold">{item.quantity_issued.toLocaleString()} plates</span>
              </div>
            ))}
          </div>
          <div className="border-t border-sand pt-3 flex justify-between items-center">
            <span className="text-xs text-taupe font-medium uppercase tracking-wide">Total</span>
            <span className="text-sm font-bold text-charcoal">{totalPlates.toLocaleString()} plates</span>
          </div>
        </div>

        {detail.adjustments.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 space-y-3">
            <h2 className="text-sm font-semibold text-amber-700">Auto-Adjustment Entries</h2>
            <div className="divide-y divide-amber-200">
              {detail.adjustments.map((adj) => (
                <div key={adj.id} className="py-3 space-y-0.5">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-charcoal">{adj.plate_size}</p>
                    <span className="text-sm font-semibold text-green-700">+{adj.quantity}</span>
                  </div>
                  {adj.reason && <p className="text-xs text-taupe">{adj.reason}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {showDelete && (
        <DeleteModal
          onConfirm={handleDelete}
          onCancel={() => { setShowDelete(false); setDeleteError(""); }}
          error={deleteError}
        />
      )}
    </div>
  );
}
