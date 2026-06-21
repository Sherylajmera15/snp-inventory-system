"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import AppHeader from "@/components/AppHeader";
import PaperItemDetail from "@/components/PaperItemDetail";
import PaperEntryForm from "@/components/PaperEntryForm";
import DeleteConfirmModal from "@/components/DeleteConfirmModal";
import api from "@/lib/api";
import { PaperInwardDetail } from "@/types/paper";
import { Pencil, Trash2 } from "lucide-react";
import { isWithin24Hours } from "@/components/EditProtectionModal";

export default function PaperDetailPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [entry, setEntry] = useState<PaperInwardDetail | null>(null);
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
      const res = await api.get(`/api/paper/${id}`);
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
    await api.delete(`/api/paper/${id}`, { data: { password } });
    router.push("/paper");
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
        <AppHeader title="Paper Entry" backHref="/paper" />
        <main className="max-w-3xl mx-auto px-6 py-10">
          <p className="text-rust">{error || "Entry not found"}</p>
        </main>
      </div>
    );
  }

  if (editing) {
    return (
      <div className="min-h-screen bg-cream">
        <AppHeader title="Edit Paper Inward Entry" backHref={`/paper/${id}`} />
        <main className="max-w-3xl mx-auto px-6 py-10">
          <PaperEntryForm
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

  return (
    <div className="min-h-screen bg-cream">
      <AppHeader title="Paper Inward Entry" backHref="/paper" />
      <main className="max-w-3xl mx-auto px-6 py-10 space-y-6">
        <div className="bg-white border border-sand rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 flex-1">
            <div>
              <p className="text-xs text-taupe uppercase tracking-wide">Inward Date</p>
              <p className="text-sm text-charcoal font-medium">
                {new Date(entry.inward_date).toLocaleDateString("en-GB")}
              </p>
            </div>
            <div>
              <p className="text-xs text-taupe uppercase tracking-wide">Time</p>
              <p className="text-sm text-charcoal font-medium">{entry.inward_time?.slice(0, 5) || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-taupe uppercase tracking-wide">Supplier Name</p>
              <p className="text-sm text-charcoal font-medium">{entry.supplier_name}</p>
            </div>
            <div>
              <p className="text-xs text-taupe uppercase tracking-wide">Invoice/Bill Number</p>
              <p className="text-sm text-charcoal font-medium">{entry.invoice_number || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-taupe uppercase tracking-wide">Work Type</p>
              <p className="text-sm text-charcoal font-medium">{entry.work_type || "—"}</p>
            </div>
            {entry.work_type === "Job Work" && (
              <div>
                <p className="text-xs text-taupe uppercase tracking-wide">Customer Name</p>
                <p className="text-sm text-charcoal font-medium">{entry.customer_name || "—"}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-taupe uppercase tracking-wide">Checked and Received By</p>
              <p className="text-sm text-charcoal font-medium">{entry.checked_received_by || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-taupe uppercase tracking-wide">Remarks</p>
              <p className="text-sm text-charcoal font-medium">{entry.remarks || "—"}</p>
            </div>
            {entry.created_by_name && (
              <div>
                <p className="text-xs text-taupe uppercase tracking-wide">Created By</p>
                <p className="text-sm text-charcoal font-medium">{entry.created_by_name}</p>
              </div>
            )}
          </div>

          {(() => {
            const within24 = isWithin24Hours(entry.inward_date, entry.inward_time ?? null);
            const canEdit = user.role === "admin" || (entry.created_by_id === user.id && within24);
            return (canEdit || user.role === "admin") ? (
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
            ) : null;
          })()}
        </div>

        <div className="space-y-4">
          <h3 className="font-semibold text-charcoal">
            Paper Items ({entry.items.length})
          </h3>
          {entry.items.map((item, i) => (
            <PaperItemDetail key={item.id} item={item} index={i} />
          ))}
        </div>
      </main>

      {showDelete && (
        <DeleteConfirmModal onConfirm={handleDelete} onClose={() => setShowDelete(false)} />
      )}
    </div>
  );
}
