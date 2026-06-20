"use client";

import { useState } from "react";
import { Lock, AlertTriangle } from "lucide-react";
import api from "@/lib/api";

interface EditProtectionModalProps {
  entryDate: string;                       // "YYYY-MM-DD"
  entryTime?: string | null;
  onAuthorized: (password: string) => void; // called with verified password
  onCancel: () => void;
}

export default function EditProtectionModal({
  entryDate,
  entryTime,
  onAuthorized,
  onCancel,
}: EditProtectionModalProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [verifying, setVerifying] = useState(false);

  async function handleVerify() {
    if (!password.trim()) { setError("Enter the administrator password."); return; }
    setVerifying(true);
    setError("");
    try {
      const res = await api.post("/api/admin/settings/check-edit-age", {
        entry_date: entryDate,
        entry_time: entryTime || null,
        edit_password: password,
      });
      if (res.data.password_verified) {
        onAuthorized(password);
      } else {
        setError("Incorrect password. Please try again.");
      }
    } catch {
      setError("Verification failed. Please try again.");
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="bg-amber-50 rounded-xl p-2.5">
            <Lock size={20} className="text-amber-600" />
          </div>
          <div>
            <h2 className="text-base font-bold text-charcoal">Protected Edit</h2>
            <p className="text-xs text-taupe">This entry is older than 24 hours.</p>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-2">
          <AlertTriangle size={15} className="text-amber-600 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-800">
            Administrator password required to edit entries older than 24 hours.
          </p>
        </div>

        <div>
          <label className="block text-xs font-medium text-taupe mb-1.5">Administrator Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(""); }}
            onKeyDown={(e) => { if (e.key === "Enter") handleVerify(); }}
            placeholder="Enter password"
            className="w-full rounded-xl border border-sand bg-cream/40 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust"
            autoFocus
          />
          {error && <p className="mt-1.5 text-xs text-red-500">{error}</p>}
        </div>

        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 border border-sand bg-white text-charcoal rounded-xl py-2.5 text-sm font-medium hover:bg-cream transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleVerify}
            disabled={verifying}
            className="flex-1 bg-rust text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-rust/90 disabled:opacity-50 transition-colors"
          >
            {verifying ? "Verifying…" : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Utility ──────────────────────────────────────────────────────────────────

export function isWithin24Hours(dateStr: string, timeStr?: string | null): boolean {
  try {
    const t = timeStr ? timeStr.slice(0, 5) : "00:00";
    const entryMs = new Date(`${dateStr}T${t}:00`).getTime();
    return Date.now() - entryMs < 24 * 60 * 60 * 1000;
  } catch {
    return true; // fail-open: don't block if we can't parse
  }
}
