"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import AppHeader from "@/components/AppHeader";
import InkEntryForm from "@/components/InkEntryForm";

export default function NewInkEntryPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream">
        <p className="text-taupe">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream">
      <AppHeader title="New Ink & Varnishes Inward Entry" backHref="/ink" />
      <main className="max-w-3xl mx-auto px-6 py-10">
        <InkEntryForm
          onSaved={(id) => router.push(`/ink/${id}`)}
          onCancel={() => router.push("/ink")}
        />
      </main>
    </div>
  );
}
