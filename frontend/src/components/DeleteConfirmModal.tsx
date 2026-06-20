"use client";

import { useState } from "react";

interface DeleteConfirmModalProps {
  onConfirm: (password: string) => Promise<void>;
  onClose: () => void;
}

export default function DeleteConfirmModal({ onConfirm, onClose }: DeleteConfirmModalProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = async () => {
    setError("");
    if (!password) {
      setError("Password is required");
      return;
    }
    setSubmitting(true);
    try {
      await onConfirm(password);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Incorrect password");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-charcoal/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl border border-sand p-6 w-full max-w-sm">
        <h3 className="font-semibold text-charcoal mb-2">Confirm Deletion</h3>
        <p className="text-sm text-taupe mb-4">
          This action cannot be undone. Enter your password to confirm.
        </p>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          placeholder="Password"
          className="w-full rounded-lg border border-sand bg-cream/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust mb-3"
        />
        {error && <p className="text-sm text-rust mb-3">{error}</p>}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting}
            className="bg-rust text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-rust/90 transition-colors disabled:opacity-60"
          >
            {submitting ? "Deleting..." : "Delete"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="bg-white border border-sand text-charcoal rounded-lg px-4 py-2 text-sm font-medium hover:border-rust transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
