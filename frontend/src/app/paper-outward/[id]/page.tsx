"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import AppHeader from "@/components/AppHeader";
import api from "@/lib/api";
import { PaperOutwardDetail } from "@/types/paper-outward";
import { AlertTriangle, Pencil, Trash2, X } from "lucide-react";
import { isWithin24Hours } from "@/components/EditProtectionModal";

function fmtDate(s: string) {
  if (!s) return "—";
  try { return new Date(s).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" }); }
  catch { return s; }
}
function fmtTime(s: string | null) {
  return s ? String(s).slice(0, 5) : "—";
}

function DeleteModal({
  onConfirm,
  onCancel,
}: {
  onConfirm: (password: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [password, setPassword] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete() {
    if (!password) { setError("Password is required."); return; }
    setDeleting(true);
    setError("");
    try {
      await onConfirm(password);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Incorrect password.";
      setError(msg);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="bg-red-50 rounded-xl p-2"><Trash2 size={18} className="text-red-600" /></div>
          <div>
            <h2 className="text-sm font-bold text-charcoal">Delete Outward Entry</h2>
            <p className="text-xs text-taupe">This action is permanent and cannot be undone.</p>
          </div>
        </div>
        {error && <p className="text-xs text-red-600 mb-3 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
        <label className="block text-xs font-medium text-taupe mb-1.5">Enter your password to confirm</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          className="w-full rounded-xl border border-sand bg-cream/40 px-3 py-2.5 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust" />
        <div className="flex gap-3">
          <button onClick={onCancel}
            className="flex-1 border border-sand bg-white text-charcoal rounded-xl py-2.5 text-sm font-medium hover:bg-cream transition-colors">
            Cancel
          </button>
          <button onClick={handleDelete} disabled={deleting}
            className="flex-1 bg-red-600 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors">
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

function toDateInput(s: string) {
  try { return new Date(s).toISOString().slice(0, 10); } catch { return s; }
}

interface PaperEditState {
  outward_date: string;
  outward_time: string;
  job_name: string;
  job_card_number: string;
  issued_by: string;
  received_by: string;
  remarks: string;
}

export default function PaperOutwardDetailPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const id = Number(params.id);

  const [entry, setEntry] = useState<PaperOutwardDetail | null>(null);
  const [fetching, setFetching] = useState(true);
  const [showDelete, setShowDelete] = useState(false);

  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState<PaperEditState | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (!user || !id) return;
    api.get(`/api/paper-outward/${id}`)
      .then((r) => setEntry(r.data))
      .catch(() => router.replace("/paper-outward"))
      .finally(() => setFetching(false));
  }, [user, id, router]);

  async function handleDelete(password: string) {
    await api.delete(`/api/paper-outward/${id}`, { data: { password } });
    router.replace("/paper-outward");
  }

  function startEdit() {
    if (!entry) return;
    setEditData({
      outward_date: toDateInput(entry.outward_date),
      outward_time: entry.outward_time ? String(entry.outward_time).slice(0, 5) : "",
      job_name: entry.job_name || "",
      job_card_number: entry.job_card_number || "",
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
      const res = await api.patch(`/api/paper-outward/${id}`, {
        ...editData,
        outward_time: editData.outward_time || null,
      });
      setEntry((prev) => prev ? { ...prev, ...res.data } : prev);
      setEditMode(false);
    } catch (e: any) {
      setSaveError(e.response?.data?.detail ?? "Failed to save changes.");
    } finally { setSaving(false); }
  }

  function cancelEdit() {
    setEditMode(false); setEditData(null); setSaveError("");
  }

  if (loading || fetching || !user) {
    return <div className="min-h-screen flex items-center justify-center bg-cream"><p className="text-taupe">Loading…</p></div>;
  }

  if (!entry) return null;

  const within24 = isWithin24Hours(toDateInput(entry.outward_date), entry.outward_time ? String(entry.outward_time).slice(0, 5) : null);
  const canEdit = user.role === "admin" || (
    (entry as any).created_by_id === user.id && within24
  );

  return (
    <div className="min-h-screen bg-cream">
      <AppHeader title="Paper Outward Entry" backHref="/paper-outward" />

      <main className="max-w-3xl mx-auto px-6 py-10 space-y-6">

        {/* Header card */}
        <div className="bg-white border border-sand rounded-2xl p-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-charcoal">{entry.job_name}</h2>
              <p className="text-sm text-taupe mt-0.5">Outward Entry #{entry.id}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {!editMode ? (
                <>
                  {canEdit && (
                    <button onClick={startEdit}
                      className="flex items-center gap-1.5 border border-sand bg-white text-charcoal rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-cream transition-colors">
                      <Pencil size={12} />Edit
                    </button>
                  )}
                  {user.role === "admin" && (
                    <button onClick={() => setShowDelete(true)}
                      className="border border-red-200 bg-red-50 text-red-600 rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-red-100 transition-colors">
                      Delete
                    </button>
                  )}
                </>
              ) : (
                <>
                  <button onClick={cancelEdit}
                    className="flex items-center gap-1 border border-sand bg-white text-charcoal rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-cream transition-colors">
                    <X size={12} />Cancel
                  </button>
                  <button onClick={handleSave} disabled={saving}
                    className="bg-rust text-white rounded-lg px-3 py-1.5 text-xs font-semibold hover:bg-rust/90 disabled:opacity-50 transition-colors">
                    {saving ? "Saving…" : "Save Changes"}
                  </button>
                </>
              )}
            </div>
          </div>

          {editMode && editData ? (
            <div className="space-y-3 pt-1">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-taupe mb-1">Date</label>
                  <input type="date" value={editData.outward_date}
                    onChange={(e) => setEditData({ ...editData, outward_date: e.target.value })}
                    className="w-full rounded-xl border border-sand bg-cream/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-taupe mb-1">Time</label>
                  <input type="time" value={editData.outward_time}
                    onChange={(e) => setEditData({ ...editData, outward_time: e.target.value })}
                    className="w-full rounded-xl border border-sand bg-cream/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-taupe mb-1">Job Name</label>
                  <input type="text" value={editData.job_name}
                    onChange={(e) => setEditData({ ...editData, job_name: e.target.value })}
                    className="w-full rounded-xl border border-sand bg-cream/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-taupe mb-1">Job Card No.</label>
                  <input type="text" value={editData.job_card_number}
                    onChange={(e) => setEditData({ ...editData, job_card_number: e.target.value })}
                    className="w-full rounded-xl border border-sand bg-cream/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-taupe mb-1">Issued By</label>
                  <input type="text" value={editData.issued_by}
                    onChange={(e) => setEditData({ ...editData, issued_by: e.target.value })}
                    className="w-full rounded-xl border border-sand bg-cream/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-taupe mb-1">Received By</label>
                  <input type="text" value={editData.received_by}
                    onChange={(e) => setEditData({ ...editData, received_by: e.target.value })}
                    className="w-full rounded-xl border border-sand bg-cream/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-taupe mb-1">Remarks</label>
                <textarea value={editData.remarks} rows={2}
                  onChange={(e) => setEditData({ ...editData, remarks: e.target.value })}
                  className="w-full rounded-xl border border-sand bg-cream/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust resize-none" />
              </div>
              {saveError && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{saveError}</p>}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-cream rounded-xl px-3 py-2.5">
                  <p className="text-xs text-taupe">Date</p>
                  <p className="text-sm font-semibold text-charcoal">{fmtDate(entry.outward_date)}</p>
                </div>
                <div className="bg-cream rounded-xl px-3 py-2.5">
                  <p className="text-xs text-taupe">Time</p>
                  <p className="text-sm font-semibold text-charcoal">{fmtTime(entry.outward_time)}</p>
                </div>
                <div className="bg-cream rounded-xl px-3 py-2.5">
                  <p className="text-xs text-taupe">Job Card No.</p>
                  <p className="text-sm font-semibold text-charcoal">{entry.job_card_number || "—"}</p>
                </div>
                <div className="bg-cream rounded-xl px-3 py-2.5">
                  <p className="text-xs text-taupe">Issued By</p>
                  <p className="text-sm font-semibold text-charcoal">{entry.issued_by || "—"}</p>
                </div>
                <div className="bg-cream rounded-xl px-3 py-2.5">
                  <p className="text-xs text-taupe">Received By</p>
                  <p className="text-sm font-semibold text-charcoal">{entry.received_by || "—"}</p>
                </div>
                <div className="bg-cream rounded-xl px-3 py-2.5">
                  <p className="text-xs text-taupe">Created By</p>
                  <p className="text-sm font-semibold text-charcoal">{(entry as any).created_by_name || "—"}</p>
                </div>
              </div>
              {entry.remarks && (
                <div className="bg-cream/60 border border-sand rounded-xl px-4 py-3">
                  <p className="text-xs text-taupe mb-0.5">Remarks</p>
                  <p className="text-sm text-charcoal">{entry.remarks}</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Paper items */}
        <div className="bg-white border border-sand rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-sand bg-cream/40">
            <h3 className="text-xs font-bold text-charcoal uppercase tracking-widest">Paper Issued</h3>
          </div>
          <div className="divide-y divide-sand/50">
            {entry.items.map((item, i) => (
              <div key={i} className="px-5 py-4 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-charcoal">
                    {item.quality} — {item.gsm} GSM
                    <span className="ml-2 text-xs font-normal text-taupe bg-sand/60 rounded-full px-2 py-0.5">
                      {item.form_type.replace(" Form", "")}
                    </span>
                  </p>
                  <p className="text-xs text-taupe mt-0.5">
                    {item.issue_method === "sheets"
                      ? "Issued by sheet count"
                      : item.issue_method === "weight"
                        ? "Issued by weight"
                        : "Reel paper"}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  {item.weight_issued !== null && (
                    <p className="text-base font-bold text-rust">{item.weight_issued.toLocaleString()} Kg</p>
                  )}
                  {item.sheets_issued !== null && (
                    <p className="text-base font-bold text-rust">{item.sheets_issued.toLocaleString()} Sheets</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Adjustment entries (if any) */}
        {entry.adjustments.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-amber-200">
              <AlertTriangle size={14} className="text-amber-600" />
              <h3 className="text-xs font-bold text-amber-800 uppercase tracking-widest">Adjustment Entries</h3>
              <p className="text-xs text-amber-600 ml-1">— Auto-created due to stock shortage</p>
            </div>
            <div className="divide-y divide-amber-200/70">
              {entry.adjustments.map((adj, i) => (
                <div key={i} className="px-5 py-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-charcoal">
                      {adj.quality} — {adj.gsm} GSM ({adj.form_type.replace(" Form", "")})
                    </p>
                    <p className="text-xs text-amber-700 mt-0.5">{adj.reason}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-base font-bold text-amber-700">+{adj.quantity.toLocaleString()} {adj.unit}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {showDelete && (
        <DeleteModal
          onConfirm={handleDelete}
          onCancel={() => setShowDelete(false)}
        />
      )}

    </div>
  );
}
