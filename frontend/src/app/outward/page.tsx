"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import AppHeader from "@/components/AppHeader";

const OUTWARD_MODULES = [
  { title: "Paper",             emoji: "📄", href: "/paper-outward" },
  { title: "CTP Plates",        emoji: "🖨️", href: "/ctp-outward" },
  { title: "Ink & Varnishes",   emoji: "🎨", href: "/ink-outward" },
  { title: "Chemicals",         emoji: "🧪", href: "/chemicals-outward" },
  { title: "Adhesives",         emoji: "🏷️", href: "/adhesives-outward" },
  { title: "Consumables",       emoji: "🔧", href: "/consumables-outward" },
  { title: "Packing Materials", emoji: "📦", href: "/packing-outward" },
  { title: "Oil & Lubrication", emoji: "🛢️", href: "/oil-outward" },
  { title: "DIES Movement",     emoji: "✂️", href: "/dies-outward" },
];

export default function OutwardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
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
      <AppHeader title="Outward" backHref="/dashboard" />

      <main className="max-w-screen-xl mx-auto px-6 py-10 space-y-6">
        <div>
          <h2 className="text-xs font-bold text-charcoal uppercase tracking-widest mb-1">Outward Modules</h2>
          <p className="text-sm text-taupe">Select a module to record outward transactions.</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {OUTWARD_MODULES.map((mod) => (
            <Link key={mod.title} href={mod.href} className="block h-full group">
              <div className="bg-white border-2 border-sand rounded-2xl p-5 h-full flex flex-col gap-3 transition-all hover:border-rust hover:shadow-lg cursor-pointer">
                <span className="text-3xl leading-none">{mod.emoji}</span>
                <div className="flex-1">
                  <p className="text-sm font-bold text-charcoal group-hover:text-rust transition-colors">
                    {mod.title}
                  </p>
                </div>
                <div className="w-2 h-2 rounded-full bg-sand group-hover:bg-rust transition-colors" />
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
