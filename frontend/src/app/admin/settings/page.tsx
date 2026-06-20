"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import AppHeader from "@/components/AppHeader";
import api from "@/lib/api";
import { CheckCircle, Lock, ShieldCheck } from "lucide-react";

export default function AdminSettingsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [passwordSet, setPasswordSet] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(true);

  const [adminPw, setAdminPw] = useState("");
  const [newEditPw, setNewEditPw] = useState("");
  const [confirmEditPw, setConfirmEditPw] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
    if (!loading && user && user.role !== "admin") router.replace("/dashboard");
  }, [user, loading, router]);

  useEffect(() => {
    if (!user || user.role !== "admin") return;
    api.get("/api/admin/settings")
      .then((r) => setPasswordSet(r.data.edit_protection_password_set))
      .catch(() => setPasswordSet(false))
      .finally(() => setChecking(false));
  }, [user]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaveMsg(null);
    if (!newEditPw.trim()) { setSaveMsg({ ok: false, text: "New password cannot be empty." }); return; }
    if (newEditPw !== confirmEditPw) { setSaveMsg({ ok: false, text: "Passwords do not match." }); return; }
    if (!adminPw.trim()) { setSaveMsg({ ok: false, text: "Your administrator password is required." }); return; }

    setSaving(true);
    try {
      await api.put("/api/admin/settings/edit-password", {
        new_password: newEditPw,
        admin_password: adminPw,
      });
      setSaveMsg({ ok: true, text: "Edit protection password updated successfully." });
      setPasswordSet(true);
      setAdminPw("");
      setNewEditPw("");
      setConfirmEditPw("");
    } catch (err: any) {
      setSaveMsg({ ok: false, text: err.response?.data?.detail ?? "Failed to update password." });
    } finally {
      setSaving(false);
    }
  }

  if (loading || !user) {
    return <div className="min-h-screen flex items-center justify-center bg-cream"><p className="text-taupe">Loading...</p></div>;
  }

  return (
    <div className="min-h-screen bg-cream">
      <AppHeader title="Admin Settings" backHref="/dashboard" />

      <main className="max-w-2xl mx-auto px-6 py-10 space-y-6">

        {/* Status card */}
        <div className="bg-white border border-sand rounded-2xl p-6 flex items-center gap-4">
          <div className={`rounded-xl p-3 ${passwordSet ? "bg-green-50" : "bg-amber-50"}`}>
            {passwordSet ? <ShieldCheck size={22} className="text-green-600" /> : <Lock size={22} className="text-amber-600" />}
          </div>
          <div>
            <p className="text-sm font-bold text-charcoal">24-Hour Edit Protection</p>
            {checking
              ? <p className="text-xs text-taupe">Checking…</p>
              : passwordSet
                ? <p className="text-xs text-green-700 mt-0.5">Active — password is configured.</p>
                : <p className="text-xs text-amber-700 mt-0.5">No password set. All users can edit any entry freely.</p>
            }
          </div>
        </div>

        {/* Password form */}
        <form onSubmit={handleSave} className="bg-white border border-sand rounded-2xl p-6 space-y-5">
          <h2 className="text-sm font-bold text-charcoal uppercase tracking-widest">
            {passwordSet ? "Change Edit Protection Password" : "Set Edit Protection Password"}
          </h2>
          <p className="text-xs text-taupe">
            Entries older than 24 hours will require this password to edit.
            The password must be entered each time an old entry is modified.
          </p>

          <div>
            <label className="block text-xs font-medium text-taupe mb-1.5">New Edit Protection Password</label>
            <input
              type="password"
              value={newEditPw}
              onChange={(e) => setNewEditPw(e.target.value)}
              placeholder="Enter new password"
              className="w-full rounded-xl border border-sand bg-cream/40 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-taupe mb-1.5">Confirm New Password</label>
            <input
              type="password"
              value={confirmEditPw}
              onChange={(e) => setConfirmEditPw(e.target.value)}
              placeholder="Re-enter new password"
              className="w-full rounded-xl border border-sand bg-cream/40 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust"
            />
          </div>

          <div className="border-t border-sand pt-4">
            <label className="block text-xs font-medium text-taupe mb-1.5">Your Administrator Login Password</label>
            <input
              type="password"
              value={adminPw}
              onChange={(e) => setAdminPw(e.target.value)}
              placeholder="Enter your login password to confirm"
              className="w-full rounded-xl border border-sand bg-cream/40 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust"
            />
            <p className="text-xs text-taupe mt-1">Required to authorise this change.</p>
          </div>

          {saveMsg && (
            <div className={`flex items-center gap-2 rounded-xl px-4 py-3 text-sm ${saveMsg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>
              {saveMsg.ok && <CheckCircle size={15} />}
              {saveMsg.text}
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-rust text-white rounded-xl py-3 text-sm font-semibold hover:bg-rust/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? "Saving…" : "Save Password"}
          </button>
        </form>

        {/* Explanation */}
        <div className="bg-white border border-sand rounded-2xl p-6 space-y-3 text-xs text-taupe">
          <p className="font-semibold text-charcoal text-sm">How edit protection works</p>
          <ul className="space-y-2 list-disc list-inside">
            <li>Entries created within the last <strong>24 hours</strong> can be edited freely by any logged-in user.</li>
            <li>Entries older than 24 hours require the edit protection password before any changes can be saved.</li>
            <li>Every protected edit is recorded in the Activity Center.</li>
            <li>Deleting entries follows the existing administrator-password rules and is unaffected by this setting.</li>
          </ul>
        </div>
      </main>
    </div>
  );
}
