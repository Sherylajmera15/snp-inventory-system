"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import AppHeader from "@/components/AppHeader";
import api from "@/lib/api";
import { Plus, RotateCcw, ShieldCheck, User as UserIcon, UserX, UserCheck, Clock, Check, X } from "lucide-react";

interface UserRecord {
  id: number;
  full_name: string;
  username: string;
  role: "admin" | "operator";
  status: string;
  is_active: boolean;
  created_at: string | null;
}

interface PendingRecord {
  id: number;
  full_name: string;
  username: string;
  mobile_number: string | null;
  created_at: string | null;
}

export default function UserManagementPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [users, setUsers] = useState<UserRecord[]>([]);
  const [pending, setPending] = useState<PendingRecord[]>([]);
  const [fetching, setFetching] = useState(true);
  const [adminCount, setAdminCount] = useState(0);

  // Create 2nd admin modal
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ full_name: "", username: "", password: "" });
  const [createError, setCreateError] = useState("");
  const [creating, setCreating] = useState(false);

  // Reset password modal
  const [resetTarget, setResetTarget] = useState<UserRecord | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetError, setResetError] = useState("");
  const [resetting, setResetting] = useState(false);

  const [actionError, setActionError] = useState("");

  useEffect(() => {
    if (!loading && (!user || user.role !== "admin")) router.replace("/dashboard");
  }, [user, loading, router]);

  function loadData() {
    setFetching(true);
    Promise.all([
      api.get("/api/admin/users"),
      api.get("/api/admin/users/pending"),
    ])
      .then(([usersRes, pendingRes]) => {
        setUsers(usersRes.data);
        setAdminCount(usersRes.data.filter((u: UserRecord) => u.role === "admin").length);
        setPending(pendingRes.data);
      })
      .finally(() => setFetching(false));
  }

  useEffect(() => {
    if (user?.role === "admin") loadData();
  }, [user]);

  async function handleApprove(p: PendingRecord) {
    setActionError("");
    try {
      await api.post(`/api/admin/users/${p.id}/approve`);
      loadData();
    } catch (err: any) {
      setActionError(err.response?.data?.detail || "Failed to approve user.");
    }
  }

  async function handleReject(p: PendingRecord) {
    setActionError("");
    try {
      await api.post(`/api/admin/users/${p.id}/reject`);
      loadData();
    } catch (err: any) {
      setActionError(err.response?.data?.detail || "Failed to reject user.");
    }
  }

  async function handleCreateAdmin(e: React.FormEvent) {
    e.preventDefault();
    setCreateError("");
    setCreating(true);
    try {
      await api.post("/api/admin/users", createForm);
      setShowCreate(false);
      setCreateForm({ full_name: "", username: "", password: "" });
      loadData();
    } catch (err: any) {
      setCreateError(err.response?.data?.detail || "Failed to create administrator.");
    } finally {
      setCreating(false);
    }
  }

  async function toggleActive(u: UserRecord) {
    setActionError("");
    try {
      await api.put(`/api/admin/users/${u.id}`, { is_active: !u.is_active });
      loadData();
    } catch (err: any) {
      setActionError(err.response?.data?.detail || "Failed to update user.");
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!resetTarget) return;
    setResetError("");
    setResetting(true);
    try {
      await api.put(`/api/admin/users/${resetTarget.id}`, { new_password: resetPassword });
      setResetTarget(null);
      setResetPassword("");
    } catch (err: any) {
      setResetError(err.response?.data?.detail || "Failed to reset password.");
    } finally {
      setResetting(false);
    }
  }

  if (loading || !user) return null;

  const admins = users.filter((u) => u.role === "admin");
  const operators = users.filter((u) => u.role === "operator");

  return (
    <div className="min-h-screen bg-cream">
      <AppHeader title="User Management" backHref="/dashboard" />
      <main className="max-w-3xl mx-auto px-6 py-10 space-y-8">

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-charcoal">Users</h1>
            <p className="text-xs text-taupe mt-0.5">
              Admins: {adminCount}/2 &nbsp;·&nbsp; Operators: {operators.length}
              {pending.length > 0 && (
                <span className="ml-2 inline-flex items-center gap-0.5 bg-amber-100 text-amber-700 rounded-full px-2 py-0.5 text-xs font-semibold">
                  {pending.length} pending
                </span>
              )}
            </p>
          </div>
          {adminCount < 2 && (
            <button
              onClick={() => { setShowCreate(true); setCreateError(""); }}
              className="flex items-center gap-1.5 bg-rust text-white rounded-xl px-4 py-2 text-sm font-medium hover:bg-rust/90 transition-colors"
            >
              <Plus size={14} /> Add Second Admin
            </button>
          )}
          {adminCount >= 2 && (
            <div className="text-xs text-taupe bg-white border border-sand rounded-xl px-3 py-2">
              Max admin limit reached (2/2)
            </div>
          )}
        </div>

        {actionError && (
          <p className="text-sm text-red-500 bg-red-50 rounded-xl px-4 py-2">{actionError}</p>
        )}

        {/* Pending Approvals */}
        {pending.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Clock size={14} className="text-amber-600" />
              <h2 className="text-xs font-bold text-charcoal uppercase tracking-widest">
                Pending Approval ({pending.length})
              </h2>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-2xl divide-y divide-amber-200/70">
              {pending.map((p) => (
                <div key={p.id} className="flex items-center gap-3 px-5 py-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-charcoal">{p.full_name}</p>
                    <p className="text-xs text-taupe">@{p.username}{p.mobile_number ? ` · ${p.mobile_number}` : ""}</p>
                    {p.created_at && (
                      <p className="text-xs text-amber-600 mt-0.5">
                        Requested {new Date(p.created_at).toLocaleDateString("en-GB")}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleApprove(p)}
                      className="flex items-center gap-1 bg-green-600 text-white rounded-lg px-3 py-1.5 text-xs font-semibold hover:bg-green-700 transition-colors"
                    >
                      <Check size={11} /> Approve
                    </button>
                    <button
                      onClick={() => handleReject(p)}
                      className="flex items-center gap-1 border border-red-200 text-red-500 bg-white rounded-lg px-3 py-1.5 text-xs font-medium hover:bg-red-50 transition-colors"
                    >
                      <X size={11} /> Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Admins */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck size={14} className="text-rust" />
            <h2 className="text-xs font-bold text-charcoal uppercase tracking-widest">
              Administrators ({admins.length}/2)
            </h2>
          </div>
          <div className="bg-white border border-sand rounded-2xl divide-y divide-sand/60">
            {admins.length === 0 && (
              <p className="text-sm text-taupe px-5 py-4">No admin accounts found.</p>
            )}
            {admins.map((u) => (
              <UserRow
                key={u.id}
                u={u}
                currentUserId={user.id}
                onToggle={() => toggleActive(u)}
                onReset={() => { setResetTarget(u); setResetPassword(""); setResetError(""); }}
              />
            ))}
          </div>
        </section>

        {/* Operators */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <UserIcon size={14} className="text-taupe" />
            <h2 className="text-xs font-bold text-charcoal uppercase tracking-widest">
              Operators ({operators.length})
            </h2>
          </div>
          {fetching ? (
            <p className="text-sm text-taupe">Loading…</p>
          ) : operators.length === 0 ? (
            <div className="bg-white border border-sand rounded-2xl px-5 py-4">
              <p className="text-sm text-taupe">No operators yet. Employees can request access from the Sign In page.</p>
            </div>
          ) : (
            <div className="bg-white border border-sand rounded-2xl divide-y divide-sand/60">
              {operators.map((u) => (
                <UserRow
                  key={u.id}
                  u={u}
                  currentUserId={user.id}
                  onToggle={() => toggleActive(u)}
                  onReset={() => { setResetTarget(u); setResetPassword(""); setResetError(""); }}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Create 2nd Admin Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
            <h2 className="text-base font-bold text-charcoal mb-1">Create Second Administrator</h2>
            <p className="text-xs text-taupe mb-4">This will be the final administrator account (2/2 limit).</p>
            <form onSubmit={handleCreateAdmin} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-taupe mb-1">Full Name</label>
                <input
                  type="text"
                  value={createForm.full_name}
                  onChange={(e) => setCreateForm({ ...createForm, full_name: e.target.value })}
                  required autoFocus placeholder="e.g. Ajit Kumar"
                  className="w-full rounded-xl border border-sand bg-cream/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-taupe mb-1">Username</label>
                <input
                  type="text"
                  value={createForm.username}
                  onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
                  required
                  className="w-full rounded-xl border border-sand bg-cream/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-taupe mb-1">Password</label>
                <input
                  type="password"
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  required minLength={6} placeholder="At least 6 characters"
                  className="w-full rounded-xl border border-sand bg-cream/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust"
                />
              </div>
              {createError && <p className="text-xs text-red-500">{createError}</p>}
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => { setShowCreate(false); setCreateError(""); }}
                  className="flex-1 border border-sand bg-white text-charcoal rounded-xl py-2.5 text-sm font-medium hover:bg-cream transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 bg-rust text-white rounded-xl py-2.5 text-sm font-medium hover:bg-rust/90 disabled:opacity-50 transition-colors"
                >
                  {creating ? "Creating…" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
            <h2 className="text-base font-bold text-charcoal mb-1">Reset Password</h2>
            <p className="text-xs text-taupe mb-4">
              Set a new password for <strong>{resetTarget.full_name}</strong> (@{resetTarget.username})
            </p>
            <form onSubmit={handleResetPassword} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-taupe mb-1">New Password</label>
                <input
                  type="password"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  required minLength={4} autoFocus
                  className="w-full rounded-xl border border-sand bg-cream/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust"
                />
              </div>
              {resetError && <p className="text-xs text-red-500">{resetError}</p>}
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => { setResetTarget(null); setResetError(""); }}
                  className="flex-1 border border-sand bg-white text-charcoal rounded-xl py-2.5 text-sm font-medium hover:bg-cream transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resetting}
                  className="flex-1 bg-rust text-white rounded-xl py-2.5 text-sm font-medium hover:bg-rust/90 disabled:opacity-50 transition-colors"
                >
                  {resetting ? "Saving…" : "Reset Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function UserRow({
  u, currentUserId, onToggle, onReset,
}: {
  u: UserRecord;
  currentUserId: number;
  onToggle: () => void;
  onReset: () => void;
}) {
  const isCurrentUser = u.id === currentUserId;
  const isDisabled = u.status === "disabled";
  const isRejected = u.status === "rejected";

  return (
    <div className="flex items-center gap-3 px-5 py-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-charcoal">{u.full_name}</p>
          {isCurrentUser && (
            <span className="text-xs bg-rust/10 text-rust rounded-full px-2 py-0.5">You</span>
          )}
          {isDisabled && (
            <span className="text-xs bg-red-50 text-red-500 border border-red-200 rounded-full px-2 py-0.5">Disabled</span>
          )}
          {isRejected && (
            <span className="text-xs bg-gray-50 text-gray-400 border border-gray-200 rounded-full px-2 py-0.5">Rejected</span>
          )}
        </div>
        <p className="text-xs text-taupe">@{u.username} · <span className="capitalize">{u.role}</span></p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={onReset}
          title="Reset password"
          className="flex items-center gap-1 border border-sand bg-white text-charcoal rounded-lg px-2.5 py-1.5 text-xs font-medium hover:bg-cream transition-colors"
        >
          <RotateCcw size={11} /> Reset PW
        </button>
        {!isCurrentUser && !isRejected && (
          <button
            onClick={onToggle}
            title={u.is_active ? "Disable account" : "Enable account"}
            className={`flex items-center gap-1 border rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
              u.is_active
                ? "border-red-200 text-red-500 bg-white hover:bg-red-50"
                : "border-green-200 text-green-600 bg-white hover:bg-green-50"
            }`}
          >
            {u.is_active ? <><UserX size={11} /> Disable</> : <><UserCheck size={11} /> Enable</>}
          </button>
        )}
      </div>
    </div>
  );
}
