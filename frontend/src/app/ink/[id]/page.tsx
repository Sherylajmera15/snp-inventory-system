"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import AppHeader from "@/components/AppHeader";
import InkItemDetail from "@/components/InkItemDetail";
import InkEntryForm from "@/components/InkEntryForm";
import DeleteConfirmModal from "@/components/DeleteConfirmModal";
import api from "@/lib/api";
import { InkInwardDetail } from "@/types/ink";
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

export default function InkDetailPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [entry, setEntry] = useState<InkInwardDetail | null>(null);
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
      const res = await api.get(`/api/ink/${id}`);
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
    await api.delete(`/api/ink/${id}`, { data: { password } });
    router.push("/ink");
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
        <AppHeader title="Ink & Varnishes Entry" backHref="/ink" />
        <main className="max-w-3xl mx-auto px-6 py-10">
          <p className="text-rust">{error || "Entry not found"}</p>
        </main>
      </div>
    );
  }

  if (editing) {
    return (
      <div className="min-h-screen bg-cream">
        <AppHeader title="Edit Ink & Varnishes Inward Entry" backHref={`/ink/${id}`} />
        <main className="max-w-3xl mx-auto px-6 py-10">
          <InkEntryForm
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
      <AppHeader title="Ink & Varnishes Inward Entry" backHref="/ink" />
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
            Ink / Varnish Items ({entry.items.length})
          </h3>
          {entry.items.map((item, i) => (
            <InkItemDetail key={item.id} item={item} index={i} />
          ))}
        </div>

        <div className="bg-cream/60 border border-sand rounded-lg p-4">
          <p className="text-sm text-charcoal">
            Grand Total Weight: <span className="font-semibold">{entry.grand_total_weight.toFixed(2)} kg</span>
          </p>
        </div>
      </main>

      {showDelete && (
        <DeleteConfirmModal onConfirm={handleDelete} onClose={() => setShowDelete(false)} />
      )}
    </div>
  );
}
