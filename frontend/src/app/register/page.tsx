"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import api from "@/lib/api";

export default function RegisterPage() {
  const [fullName, setFullName] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) { setError("Passwords do not match."); return; }
    if (password.length < 4) { setError("Password must be at least 4 characters."); return; }
    setError("");
    setSubmitting(true);
    try {
      await api.post("/api/auth/register", {
        full_name: fullName,
        mobile_number: mobileNumber,
        username,
        password,
      });
      setSubmitted(true);
    } catch (err: unknown) {
      setError((err as { response?: { data?: { detail?: string } } }).response?.data?.detail || "Registration failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream px-4">
        <div className="w-full max-w-sm">
          <div className="bg-white rounded-2xl border border-sand shadow-sm p-8 text-center">
            <div className="w-14 h-14 bg-green-50 border border-green-200 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">✓</span>
            </div>
            <h2 className="text-lg font-semibold text-charcoal mb-2">Request Submitted</h2>
            <p className="text-sm text-taupe leading-relaxed mb-6">
              Your account request has been submitted and is awaiting administrator approval.
            </p>
            <Link
              href="/login"
              className="block w-full bg-rust text-white rounded-lg py-2.5 text-sm font-medium hover:bg-rust/90 transition-colors text-center"
            >
              Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-cream px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-charcoal tracking-tight">Shri Neminath Printers</h1>
          <p className="text-sm text-taupe mt-1">Operator Account Request</p>
        </div>

        <div className="bg-white rounded-2xl border border-sand shadow-sm p-8">
          <h2 className="text-lg font-semibold text-charcoal mb-1">Create Operator Account</h2>
          <p className="text-xs text-taupe mb-5">Your request will be reviewed and approved by an administrator.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1">Full Name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                autoFocus
                placeholder="Your full name"
                className="w-full rounded-lg border border-sand bg-cream/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1">Mobile Number</label>
              <input
                type="tel"
                value={mobileNumber}
                onChange={(e) => setMobileNumber(e.target.value)}
                required
                placeholder="10-digit mobile number"
                className="w-full rounded-lg border border-sand bg-cream/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                placeholder="Choose a username for login"
                className="w-full rounded-lg border border-sand bg-cream/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={4}
                placeholder="At least 4 characters"
                className="w-full rounded-lg border border-sand bg-cream/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1">Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full rounded-lg border border-sand bg-cream/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust"
              />
            </div>

            {error && <p className="text-sm text-rust">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-rust text-white rounded-lg py-2.5 text-sm font-medium hover:bg-rust/90 transition-colors disabled:opacity-60"
            >
              {submitting ? "Submitting…" : "Submit Request"}
            </button>
          </form>
        </div>

        <div className="mt-4 text-center">
          <Link href="/login" className="text-sm text-taupe hover:text-rust transition-colors">
            Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
