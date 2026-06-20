"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import AppHeader from "@/components/AppHeader";
import AdhesiveEntryForm from "@/components/AdhesiveEntryForm";

export default function NewAdhesiveEntryPage() {
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
      <AppHeader title="New Adhesives Inward Entry" backHref="/adhesives" />
      <main className="max-w-3xl mx-auto px-6 py-10">
        <AdhesiveEntryForm
          onSaved={(id) => router.push(`/adhesives/${id}`)}
          onCancel={() => router.push("/adhesives")}
        />
      </main>
    </div>
  );
}
