"use client";

import { useState, FormEvent, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api";

export default function LoginPage() {
  const { login, user, loading } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [keepLoggedIn, setKeepLoggedIn] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [checkingSetup, setCheckingSetup] = useState(true);

  useEffect(() => {
    if (!loading && user) {
      router.replace("/dashboard");
      return;
    }
    api.get("/api/auth/system-status")
      .then((res) => {
        if (res.data.needs_setup) {
          router.replace("/setup");
        } else {
          setCheckingSetup(false);
        }
      })
      .catch(() => setCheckingSetup(false));
  }, [user, loading, router]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(username, password, keepLoggedIn);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Login failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || checkingSetup) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream">
        <p className="text-taupe">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-cream px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          {/* Company logo */}
          <div className="flex justify-center mb-5">
            <img
              src="/logo.png"
              alt="SNP Logo"
              className="h-20 w-auto object-contain"
            />
          </div>
          <h1 className="text-2xl font-semibold text-charcoal tracking-tight">
            SNP ERP
          </h1>
          <p className="text-sm text-taupe mt-1">Shri Neminath Printers & Packaging</p>
        </div>

        <div className="bg-white rounded-2xl border border-sand shadow-sm p-8">
          <h2 className="text-lg font-semibold text-charcoal mb-6">Sign In</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-charcoal mb-1">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
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
                className="w-full rounded-lg border border-sand bg-cream/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust"
              />
            </div>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={keepLoggedIn}
                onChange={(e) => setKeepLoggedIn(e.target.checked)}
                className="w-4 h-4 rounded border-sand accent-rust"
              />
              <span className="text-sm text-charcoal">Keep me logged in</span>
            </label>

            {error && <p className="text-sm text-rust">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-rust text-white rounded-lg py-2.5 text-sm font-medium hover:bg-rust/90 transition-colors disabled:opacity-60"
            >
              {submitting ? "Signing in…" : "Sign In"}
            </button>
          </form>
        </div>

        <div className="mt-4 text-center">
          <Link
            href="/register"
            className="text-sm text-taupe hover:text-rust transition-colors"
          >
            Create Operator Account
          </Link>
        </div>
      </div>
    </div>
  );
}
