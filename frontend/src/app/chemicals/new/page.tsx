"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import AppHeader from "@/components/AppHeader";
import ChemicalEntryForm from "@/components/ChemicalEntryForm";

export default function NewChemicalEntryPage() {
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
      <AppHeader title="New Chemicals Inward Entry" backHref="/chemicals" />
      <main className="max-w-3xl mx-auto px-6 py-10">
        <ChemicalEntryForm
          onSaved={(id) => router.push(`/chemicals/${id}`)}
          onCancel={() => router.push("/chemicals")}
        />
      </main>
    </div>
  );
}
