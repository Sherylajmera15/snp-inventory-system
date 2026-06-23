"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import AppHeader from "@/components/AppHeader";
import DeleteConfirmModal from "@/components/DeleteConfirmModal";
import api from "@/lib/api";
import { LaminationOutwardDetail, LAMINATION_ISSUED_BY_OPTIONS } from "@/types/lamination";
import { Pencil, Trash2, X } from "lucide-react";
import { isWithin24Hours } from "@/components/EditProtectionModal";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="bg-cream rounded-xl px-3 py-2.5">
      <p className="text-xs text-taupe">{label}</p>
      <p className="text-sm font-semibold text-charcoal">{value || "—"}</p>
    </div>
  );
}

const inputClass =
  "w-full rounded-xl border border-sand bg-cream/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust";

interface EditState {
  outward_date: string;
  outward_time: string;
  receiver_name: string;
  issued_by: string;
  issued_by_other: string;
  remarks: string;
}

function filmTypeLabel(film_type: string, custom_type?: string | null) {
  if (film_type === "OTHER" && custom_type) return custom_type;
  return film_type;
}

export default function LaminationOutwardDetailPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [entry, setEntry] = useState<LaminationOutwardDetail | null>(null);
  const [fetching, setFetching] = useState(true);
  const [showDelete, setShowDelete] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    api
      .get<LaminationOutwardDetail>(`/api/lamination-outward/${id}`)
      .then((res) => setEntry(res.data))
      .catch(() => router.replace("/lamination-outward"))
      .finally(() => setFetching(false));
  }, [user, id, router]);

  const handleDelete = async (password: string) => {
    await api.delete(`/api/lamination-outward/${id}`, { data: { password } });
    router.push("/lamination-outward");
  };

  function startEdit() {
    if (!entry) return;
    const isKnownOption = (LAMINATION_ISSUED_BY_OPTIONS as readonly string[]).includes(entry.issued_by ?? "");
    setEditData({
      outward_date: entry.outward_date,
      outward_time: entry.outward_time ? String(entry.outward_time).slice(0, 5) : "",
      receiver_name: entry.receiver_name || "",
      issued_by: isKnownOption ? (entry.issued_by ?? "") : "Other",
      issued_by_other: isKnownOption ? "" : (entry.issued_by ?? ""),
      remarks: entry.remarks || "",
    });
    setEditMode(true);
  }

  async function handleSave() {
    if (!editData || !entry) return;
    setSaving(true);
    setSaveError("");
    try {
      const finalIssuedBy = editData.issued_by === "Other" ? editData.issued_by_other.trim() : editData.issued_by;
      const res = await api.put(`/api/lamination-outward/${id}`, {
        outward_date: editData.outward_date,
        outward_time: editData.outward_time || null,
        receiver_name: editData.receiver_name.trim() || null,
        issued_by: finalIssuedBy || null,
        remarks: editData.remarks.trim() || null,
      });
      setEntry({ ...entry, ...res.data });
      setEditMode(false);
    } catch (e: unknown) {
      setSaveError(
        (e as { response?: { data?: { detail?: string } } }).response?.data?.detail ?? "Failed to save changes."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading || !user || fetching) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream">
        <p className="text-taupe">Loading...</p>
      </div>
    );
  }

  if (!entry) return null;

  const within24 = isWithin24Hours(entry.outward_date, entry.outward_time ?? null);
  const canEdit = user.role === "admin" || (entry.created_by_id === user.id && within24);

  return (
    <div className="min-h-screen bg-cream">
      <AppHeader title="Lamination Film Outward Entry" backHref="/lamination-outward" />
      <main className="max-w-3xl mx-auto px-6 py-10 space-y-6">

        {/* Header Card */}
        <div className="bg-white border border-sand rounded-2xl p-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-charcoal">Outward Entry #{entry.id}</h2>
              <p className="text-sm text-taupe mt-0.5">
                {new Date(entry.outward_date).toLocaleDateString("en-GB", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}
                {entry.outward_time ? ` · ${String(entry.outward_time).slice(0, 5)}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {!editMode ? (
                <>
                  {canEdit && (
                    <button
                      onClick={startEdit}
                      className="flex items-center gap-1.5 border border-sand bg-white text-charcoal rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-cream transition-colors"
                    >
                      <Pencil size={12} />Edit
                    </button>
                  )}
                  {user.role === "admin" && (
                    <button
                      onClick={() => setShowDelete(true)}
                      className="border border-red-200 bg-red-50 text-red-600 rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-red-100 transition-colors"
                    >
                      <Trash2 size={12} className="inline mr-1" />Delete
                    </button>
                  )}
                </>
              ) : (
                <>
                  <button
                    onClick={() => { setEditMode(false); setEditData(null); setSaveError(""); }}
                    className="flex items-center gap-1 border border-sand bg-white text-charcoal rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-cream transition-colors"
                  >
                    <X size={12} />Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="bg-rust text-white rounded-lg px-3 py-1.5 text-xs font-semibold hover:bg-rust/90 disabled:opacity-50 transition-colors"
                  >
                    {saving ? "Saving…" : "Save Changes"}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Film type badge */}
          <div className="flex items-center gap-2">
            <span className="inline-block text-xs font-semibold px-2.5 py-1 rounded-full bg-rust/10 text-rust border border-rust/20">
              {filmTypeLabel(entry.film_type, entry.custom_type)}
            </span>
            {(entry.film_length || entry.film_width) && (
              <span className="text-xs text-taupe">
                {entry.film_length ?? "?"}×{entry.film_width ?? "?"} mm
              </span>
            )}
            <span className="text-xs font-semibold text-charcoal ml-auto">
              {entry.quantity_issued.toFixed(3)} kg issued
            </span>
          </div>

          {editMode && editData ? (
            <div className="space-y-3 pt-1">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-taupe mb-1">Date</label>
                  <input type="date" value={editData.outward_date}
                    onChange={(e) => setEditData({ ...editData, outward_date: e.target.value })}
                    className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-taupe mb-1">Time</label>
                  <input type="time" value={editData.outward_time}
                    onChange={(e) => setEditData({ ...editData, outward_time: e.target.value })}
                    className={inputClass} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-taupe mb-1">Receiver Name</label>
                  <input type="text" value={editData.receiver_name}
                    onChange={(e) => setEditData({ ...editData, receiver_name: e.target.value })}
                    className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-taupe mb-1">Issued By</label>
                  <select value={editData.issued_by}
                    onChange={(e) => setEditData({ ...editData, issued_by: e.target.value })}
                    className={inputClass}>
                    <option value="">—</option>
                    {LAMINATION_ISSUED_BY_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                  {editData.issued_by === "Other" && (
                    <input type="text" value={editData.issued_by_other}
                      onChange={(e) => setEditData({ ...editData, issued_by_other: e.target.value })}
                      className={`${inputClass} mt-2`}
                      placeholder="Enter name" />
                  )}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-taupe mb-1">Remarks</label>
                <textarea value={editData.remarks} rows={2}
                  onChange={(e) => setEditData({ ...editData, remarks: e.target.value })}
                  className={`${inputClass} resize-none`} />
              </div>
              {saveError && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{saveError}</p>}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Field label="Receiver Name" value={entry.receiver_name} />
              <Field label="Issued By" value={entry.issued_by} />
              <Field label="Created By" value={entry.created_by_name} />
              {entry.remarks && (
                <div className="col-span-2 sm:col-span-3 bg-cream/60 border border-sand rounded-xl px-4 py-3">
                  <p className="text-xs text-taupe mb-0.5">Remarks</p>
                  <p className="text-sm text-charcoal">{entry.remarks}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Roll Consumption */}
        {entry.items.length > 0 && (
          <div className="space-y-4">
            <h3 className="font-semibold text-charcoal">Roll Consumption ({entry.items.length} rolls)</h3>
            <div className="bg-white border border-sand rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-cream text-left text-taupe text-xs uppercase tracking-wide">
                    <th className="px-5 py-3 font-medium">Roll #</th>
                    <th className="px-5 py-3 font-medium">Weight Taken (kg)</th>
                  </tr>
                </thead>
                <tbody>
                  {entry.items.map((item) => (
                    <tr key={item.id} className="border-t border-sand">
                      <td className="px-5 py-3 text-charcoal font-medium">{item.roll_number}</td>
                      <td className="px-5 py-3 text-charcoal">{item.weight_taken.toFixed(3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Adjustments */}
        {entry.adjustments.length > 0 && (
          <div className="space-y-4">
            <h3 className="font-semibold text-charcoal">Deficit Adjustments</h3>
            <div className="bg-amber-50 border border-amber-200 rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-amber-100/60 text-left text-amber-700 text-xs uppercase tracking-wide">
                    <th className="px-5 py-3 font-medium">Film Type</th>
                    <th className="px-5 py-3 font-medium">Quantity (kg)</th>
                    <th className="px-5 py-3 font-medium">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {entry.adjustments.map((adj) => (
                    <tr key={adj.id} className="border-t border-amber-200">
                      <td className="px-5 py-3 text-charcoal font-medium">
                        {adj.film_type === "OTHER" && adj.custom_type ? adj.custom_type : adj.film_type}
                      </td>
                      <td className="px-5 py-3 text-amber-700 font-semibold">{adj.quantity.toFixed(3)}</td>
                      <td className="px-5 py-3 text-charcoal">{adj.reason || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {showDelete && (
        <DeleteConfirmModal onConfirm={handleDelete} onClose={() => setShowDelete(false)} />
      )}
    </div>
  );
}
