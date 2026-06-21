"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import AppHeader from "@/components/AppHeader";
import CTPEntryForm from "@/components/CTPEntryForm";
import DeleteConfirmModal from "@/components/DeleteConfirmModal";
import api from "@/lib/api";
import { CTPInwardDetail } from "@/types/ctp";
import { Pencil, Trash2 } from "lucide-react";
import { isWithin24Hours } from "@/components/EditProtectionModal";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-taupe uppercase tracking-wide">{label}</p>
      <p className="text-sm text-charcoal font-medium">{value}</p>
    </div>
  );
}

export default function CTPDetailPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [entry, setEntry] = useState<CTPInwardDetail | null>(null);
  const [fetching, setFetching] = useState(true);
  const [editing, setEditing] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  const fetchEntry = async () => {
    setFetching(true);
    try {
      const res = await api.get(`/api/ctp/${id}`);
      setEntry(res.data);
    } catch (err: unknown) {
      setError((err as { response?: { data?: { detail?: string } } }).response?.data?.detail || "Failed to load entry");
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchEntry();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, id]);

  const handleDelete = async (password: string) => {
    await api.delete(`/api/ctp/${id}`, { data: { password } });
    router.push("/ctp");
  };

  if (loading || !user || fetching) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream">
        <p className="text-taupe">Loading...</p>
      </div>
    );
  }

  if (error || !entry) {
    return (
      <div className="min-h-screen bg-cream">
        <AppHeader title="CTP Plates Entry" backHref="/ctp" />
        <main className="max-w-3xl mx-auto px-6 py-10">
          <p className="text-rust">{error || "Entry not found"}</p>
        </main>
      </div>
    );
  }

  if (editing) {
    return (
      <div className="min-h-screen bg-cream">
        <AppHeader title="Edit CTP Plates Inward Entry" backHref={`/ctp/${id}`} />
        <main className="max-w-3xl mx-auto px-6 py-10">
          <CTPEntryForm
            initialData={entry}
            onSaved={() => {
              setEditing(false);
              fetchEntry();
            }}
            onCancel={() => setEditing(false)}
          />
        </main>
      </div>
    );
  }

  const within24 = isWithin24Hours(entry.inward_date, entry.inward_time ?? null);
  const canEdit = user.role === "admin" || (entry.created_by_id === user.id && within24);

  return (
    <div className="min-h-screen bg-cream">
      <AppHeader title="CTP Plates Inward Entry" backHref="/ctp" />
      <main className="max-w-3xl mx-auto px-6 py-10 space-y-6">
        <div className="bg-white border border-sand rounded-2xl p-5 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
            <Field label="Date" value={new Date(entry.inward_date).toLocaleDateString("en-GB")} />
            <Field label="Time" value={entry.inward_time?.slice(0, 5)} />
            <Field label="Supplier Name" value={entry.supplier_name} />
            <Field label="Invoice/Bill Number" value={entry.invoice_number || "—"} />
            <Field label="Checked and Received By" value={entry.checked_received_by || "—"} />
            <Field label="Remarks" value={entry.remarks || "—"} />
            {entry.created_by_name && (
              <Field label="Created By" value={entry.created_by_name} />
            )}
          </div>

          {(canEdit || user.role === "admin") && (
            <div className="flex gap-2 flex-shrink-0">
              {canEdit && (
                <button
                  onClick={() => setEditing(true)}
                  className="inline-flex items-center gap-2 bg-white border border-sand text-charcoal rounded-lg px-3 py-2 text-sm font-medium hover:border-rust transition-colors"
                >
                  <Pencil size={16} />
                  Edit
                </button>
              )}
              {user.role === "admin" && (
                <button
                  onClick={() => setShowDelete(true)}
                  className="inline-flex items-center gap-2 bg-white border border-sand text-rust rounded-lg px-3 py-2 text-sm font-medium hover:border-rust transition-colors"
                >
                  <Trash2 size={16} />
                  Delete
                </button>
              )}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <h3 className="font-semibold text-charcoal">
            Plate Sizes ({entry.plate_sizes.length})
          </h3>
          {entry.plate_sizes.map((p) => (
            <div key={p.size_number} className="border border-sand rounded-2xl p-5 bg-white">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xs font-semibold uppercase tracking-wide text-rust">
                  Size {p.size_number}
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-sand text-charcoal">
                  {p.plate_size}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Field label="Length (mm)" value={p.length_mm} />
                <Field label="Width (mm)" value={p.width_mm} />
                <Field label="Total Packets" value={p.total_packets} />
                <Field label="Plates Per Packet" value={p.plates_per_packet} />
              </div>
              <div className="mt-3 pt-3 border-t border-sand">
                <Field label="Total Plates Received" value={p.total_plates} />
              </div>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="bg-cream/60 border border-sand rounded-lg p-4 space-y-1">
          <h3 className="font-semibold text-charcoal mb-2">Summary</h3>
          {entry.plate_sizes.map((p) => (
            <p key={p.size_number} className="text-sm text-charcoal">
              {p.length_mm} × {p.width_mm} mm = <span className="font-semibold">{p.total_plates}</span> plates
            </p>
          ))}
          <p className="text-sm text-charcoal mt-2 pt-2 border-t border-sand">
            Grand Total Plates Received: <span className="font-semibold">{entry.grand_total_plates}</span>
          </p>
        </div>
      </main>

      {showDelete && (
        <DeleteConfirmModal onConfirm={handleDelete} onClose={() => setShowDelete(false)} />
      )}
    </div>
  );
}
