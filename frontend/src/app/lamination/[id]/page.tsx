"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import AppHeader from "@/components/AppHeader";
import DeleteConfirmModal from "@/components/DeleteConfirmModal";
import api from "@/lib/api";
import {
  LaminationInwardDetail,
  LaminationFilmType,
  LAMINATION_FILM_TYPES,
  LAMINATION_RECEIVED_BY_OPTIONS,
} from "@/types/lamination";
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
  inward_date: string;
  inward_time: string;
  supplier_name: string;
  invoice_number: string;
  received_by: string;
  received_by_other: string;
  remarks: string;
  film_type: string;
  custom_type: string;
  film_length: string;
  film_width: string;
}

function filmTypeLabel(film_type: string, custom_type?: string | null) {
  if (film_type === "OTHER" && custom_type) return custom_type;
  return film_type;
}

function filmTypeBadgeClass(film_type: string) {
  switch (film_type) {
    case "PVC": return "bg-blue-100 text-blue-700 border border-blue-200";
    case "BOPP": return "bg-green-100 text-green-700 border border-green-200";
    case "SILVER": return "bg-gray-100 text-gray-700 border border-gray-200";
    case "HOLOGRAPHIC": return "bg-purple-100 text-purple-700 border border-purple-200";
    default: return "bg-amber-100 text-amber-700 border border-amber-200";
  }
}

export default function LaminationDetailPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [entry, setEntry] = useState<LaminationInwardDetail | null>(null);
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
      .get<LaminationInwardDetail>(`/api/lamination/${id}`)
      .then((res) => setEntry(res.data))
      .catch(() => router.replace("/lamination"))
      .finally(() => setFetching(false));
  }, [user, id, router]);

  const handleDelete = async (password: string) => {
    await api.delete(`/api/lamination/${id}`, { data: { password } });
    router.push("/lamination");
  };

  function startEdit() {
    if (!entry) return;
    const isKnownOption = (LAMINATION_RECEIVED_BY_OPTIONS as readonly string[]).includes(entry.received_by);
    setEditData({
      inward_date: entry.inward_date,
      inward_time: entry.inward_time ? String(entry.inward_time).slice(0, 5) : "",
      supplier_name: entry.supplier_name,
      invoice_number: entry.invoice_number || "",
      received_by: isKnownOption ? entry.received_by : "Other",
      received_by_other: isKnownOption ? "" : entry.received_by,
      remarks: entry.remarks || "",
      film_type: entry.film_type,
      custom_type: entry.custom_type || "",
      film_length: entry.film_length != null ? String(entry.film_length) : "",
      film_width: entry.film_width != null ? String(entry.film_width) : "",
    });
    setEditMode(true);
  }

  async function handleSave() {
    if (!editData || !entry) return;
    setSaving(true);
    setSaveError("");
    try {
      if (!editData.supplier_name.trim()) { setSaveError("Supplier Name is required"); setSaving(false); return; }
      const finalReceivedBy = editData.received_by === "Other" ? editData.received_by_other.trim() : editData.received_by;
      if (!finalReceivedBy) { setSaveError("Received By is required"); setSaving(false); return; }
      if (!editData.film_type) { setSaveError("Film Type is required"); setSaving(false); return; }
      if (editData.film_type === "OTHER" && !editData.custom_type.trim()) {
        setSaveError("Custom Type is required when Film Type is OTHER");
        setSaving(false);
        return;
      }

      const res = await api.put(`/api/lamination/${id}`, {
        inward_date: editData.inward_date,
        inward_time: editData.inward_time || null,
        supplier_name: editData.supplier_name.trim(),
        invoice_number: editData.invoice_number.trim() || null,
        received_by: finalReceivedBy,
        remarks: editData.remarks.trim() || null,
        film_type: editData.film_type,
        custom_type: editData.film_type === "OTHER" ? editData.custom_type.trim() : null,
        film_length: editData.film_length ? Number(editData.film_length) : null,
        film_width: editData.film_width ? Number(editData.film_width) : null,
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

  const within24 = isWithin24Hours(entry.inward_date, entry.inward_time ?? null);
  const canEdit = user.role === "admin" || (entry.created_by_id === user.id && within24);

  const totalOriginal = entry.rolls.reduce((s, r) => s + r.original_weight, 0);
  const totalRemaining = entry.rolls.reduce((s, r) => s + r.remaining_weight, 0);
  const activeRolls = entry.rolls.filter((r) => !r.is_consumed).length;

  return (
    <div className="min-h-screen bg-cream">
      <AppHeader title="Lamination Film Entry" backHref="/lamination" />
      <main className="max-w-3xl mx-auto px-6 py-10 space-y-6">

        {/* Header Card */}
        <div className="bg-white border border-sand rounded-2xl p-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-charcoal">Lamination Entry #{entry.id}</h2>
              <p className="text-sm text-taupe mt-0.5">
                {new Date(entry.inward_date).toLocaleDateString("en-GB", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}
                {entry.inward_time ? ` · ${String(entry.inward_time).slice(0, 5)}` : ""}
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

          {editMode && editData ? (
            <div className="space-y-3 pt-1">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-taupe mb-1">Date</label>
                  <input type="date" value={editData.inward_date}
                    onChange={(e) => setEditData({ ...editData, inward_date: e.target.value })}
                    className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-taupe mb-1">Time</label>
                  <input type="time" value={editData.inward_time}
                    onChange={(e) => setEditData({ ...editData, inward_time: e.target.value })}
                    className={inputClass} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-taupe mb-1">Supplier Name *</label>
                  <input type="text" value={editData.supplier_name}
                    onChange={(e) => setEditData({ ...editData, supplier_name: e.target.value })}
                    className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-taupe mb-1">Invoice Number</label>
                  <input type="text" value={editData.invoice_number}
                    onChange={(e) => setEditData({ ...editData, invoice_number: e.target.value })}
                    className={inputClass} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-taupe mb-1">Received By *</label>
                <select value={editData.received_by}
                  onChange={(e) => setEditData({ ...editData, received_by: e.target.value })}
                  className={inputClass}>
                  <option value="" disabled>Select…</option>
                  {LAMINATION_RECEIVED_BY_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
                {editData.received_by === "Other" && (
                  <input type="text" value={editData.received_by_other}
                    onChange={(e) => setEditData({ ...editData, received_by_other: e.target.value })}
                    className={`${inputClass} mt-2`}
                    placeholder="Enter name" />
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-taupe mb-1">Film Type *</label>
                <select value={editData.film_type}
                  onChange={(e) => setEditData({ ...editData, film_type: e.target.value })}
                  className={inputClass}>
                  <option value="" disabled>Select…</option>
                  {LAMINATION_FILM_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              {editData.film_type === "OTHER" && (
                <div>
                  <label className="block text-xs font-medium text-taupe mb-1">Custom Type *</label>
                  <input type="text" value={editData.custom_type}
                    onChange={(e) => setEditData({ ...editData, custom_type: e.target.value })}
                    className={inputClass} />
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-taupe mb-1">Film Length (mm)</label>
                  <input type="number" value={editData.film_length}
                    onChange={(e) => setEditData({ ...editData, film_length: e.target.value })}
                    onWheel={(e) => e.currentTarget.blur()} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-taupe mb-1">Film Width (mm)</label>
                  <input type="number" value={editData.film_width}
                    onChange={(e) => setEditData({ ...editData, film_width: e.target.value })}
                    onWheel={(e) => e.currentTarget.blur()} className={inputClass} />
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
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full ${filmTypeBadgeClass(entry.film_type)}`}>
                  {filmTypeLabel(entry.film_type, entry.custom_type)}
                </span>
                {(entry.film_length || entry.film_width) && (
                  <span className="text-xs text-taupe">
                    {entry.film_length ?? "?"}×{entry.film_width ?? "?"} mm
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <Field label="Supplier" value={entry.supplier_name} />
                <Field label="Invoice Number" value={entry.invoice_number} />
                <Field label="Received By" value={entry.received_by} />
                <Field label="Created By" value={entry.created_by_name} />
                {entry.remarks && (
                  <div className="col-span-2 sm:col-span-3 bg-cream/60 border border-sand rounded-xl px-4 py-3">
                    <p className="text-xs text-taupe mb-0.5">Remarks</p>
                    <p className="text-sm text-charcoal">{entry.remarks}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Stock Summary */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white border border-sand rounded-2xl px-4 py-4 text-center">
            <p className="text-xs text-taupe mb-1">Total Rolls</p>
            <p className="text-2xl font-bold text-charcoal">{entry.rolls.length}</p>
          </div>
          <div className="bg-white border border-sand rounded-2xl px-4 py-4 text-center">
            <p className="text-xs text-taupe mb-1">Active Rolls</p>
            <p className="text-2xl font-bold text-green-700">{activeRolls}</p>
          </div>
          <div className="bg-white border border-sand rounded-2xl px-4 py-4 text-center">
            <p className="text-xs text-taupe mb-1">Remaining (kg)</p>
            <p className="text-2xl font-bold text-rust">{totalRemaining.toFixed(3)}</p>
          </div>
        </div>

        {/* Rolls Table */}
        <div className="space-y-4">
          <h3 className="font-semibold text-charcoal">
            Rolls ({entry.rolls.length}) — Total Original: {totalOriginal.toFixed(3)} kg
          </h3>
          <div className="bg-white border border-sand rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-cream text-left text-taupe text-xs uppercase tracking-wide">
                  <th className="px-5 py-3 font-medium">Roll #</th>
                  <th className="px-5 py-3 font-medium">Original Wt (kg)</th>
                  <th className="px-5 py-3 font-medium">Remaining Wt (kg)</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {entry.rolls.map((roll) => (
                  <tr key={roll.id} className="border-t border-sand">
                    <td className="px-5 py-3 text-charcoal font-medium">{roll.roll_number}</td>
                    <td className="px-5 py-3 text-charcoal">{roll.original_weight.toFixed(3)}</td>
                    <td className="px-5 py-3 text-charcoal">{roll.remaining_weight.toFixed(3)}</td>
                    <td className="px-5 py-3">
                      {roll.is_consumed ? (
                        <span className="inline-block text-xs font-medium px-2.5 py-1 rounded-full bg-gray-100 text-gray-500 border border-gray-200">
                          Consumed
                        </span>
                      ) : (
                        <span className="inline-block text-xs font-medium px-2.5 py-1 rounded-full bg-green-50 text-green-700 border border-green-200">
                          Active
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {showDelete && (
        <DeleteConfirmModal onConfirm={handleDelete} onClose={() => setShowDelete(false)} />
      )}
    </div>
  );
}
