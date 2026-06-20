"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import AppHeader from "@/components/AppHeader";
import DieItemDetail from "@/components/DieItemDetail";
import DieEntryForm from "@/components/DieEntryForm";
import DeleteConfirmModal from "@/components/DeleteConfirmModal";
import api from "@/lib/api";
import { DiesInwardDetail } from "@/types/dies";
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

export default function DieDetailPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [entry, setEntry] = useState<DiesInwardDetail | null>(null);
  const [fetching, setFetching] = useState(true);
  const [editing, setEditing] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  const fetchEntry = async () => {
    setFetching(true);
    try {
      const res = await api.get(`/api/dies/${id}`);
      setEntry(res.data);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } } };
      setError(axiosErr.response?.data?.detail || "Failed to load entry");
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
    await api.delete(`/api/dies/${id}`, { data: { password } });
    router.push("/dies");
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
        <AppHeader title="Die Entry" backHref="/dies" />
        <main className="max-w-3xl mx-auto px-6 py-10">
          <p className="text-rust">{error || "Entry not found"}</p>
        </main>
      </div>
    );
  }

  if (editing) {
    return (
      <div className="min-h-screen bg-cream">
        <AppHeader title="Edit Die Entry" backHref={`/dies/${id}`} />
        <main className="max-w-3xl mx-auto px-6 py-10">
          <DieEntryForm
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

  const activeCount = entry.items.filter((i) => i.status === "Active").length;
  const discontinuedCount = entry.items.filter((i) => i.status === "Discontinued").length;
  const within24 = isWithin24Hours(entry.inward_date, (entry as any).inward_time ?? null);
  const canEdit = user.role === "admin" || ((entry as any).created_by_id === user.id && within24);

  return (
    <div className="min-h-screen bg-cream">
      <AppHeader title="Die Inward Entry" backHref="/dies" />
      <main className="max-w-3xl mx-auto px-6 py-10 space-y-6">

        {/* Header card */}
        <div className="bg-white border border-sand rounded-2xl p-5 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
            <Field
              label="Date"
              value={new Date(entry.inward_date).toLocaleDateString("en-GB")}
            />
            <Field label="Time" value={entry.inward_time?.slice(0, 5)} />
            <Field label="Supplier Name" value={entry.supplier_name} />
            <Field label="Invoice / Bill Number" value={entry.invoice_number || "—"} />
            <Field label="Checked and Received By" value={entry.checked_received_by || "—"} />
            <Field label="Remarks" value={entry.remarks || "—"} />
            {(entry as any).created_by_name && (
              <Field label="Created By" value={(entry as any).created_by_name} />
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

        {/* Summary badges */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-sm font-semibold text-charcoal">
            {entry.items.length} {entry.items.length === 1 ? "Die" : "Dies"}
          </span>
          {activeCount > 0 && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
              {activeCount} Active
            </span>
          )}
          {discontinuedCount > 0 && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
              {discontinuedCount} Discontinued
            </span>
          )}
        </div>

        {/* Die items */}
        <div className="space-y-4">
          {entry.items.map((item, i) => (
            <DieItemDetail key={item.id} item={item} index={i} />
          ))}
        </div>
      </main>

      {showDelete && (
        <DeleteConfirmModal onConfirm={handleDelete} onClose={() => setShowDelete(false)} />
      )}
    </div>
  );
}
