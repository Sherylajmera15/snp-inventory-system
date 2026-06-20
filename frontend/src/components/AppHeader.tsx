"use client";

import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/context/ThemeContext";
import { LogOut, ArrowLeft, Moon, Sun, Activity } from "lucide-react";

interface AppHeaderProps {
  title: string;
  backHref?: string;
}

export default function AppHeader({ title, backHref }: AppHeaderProps) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="border-b border-sand bg-white sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Logo — home button */}
          <Link href="/dashboard" className="flex items-center gap-2 shrink-0" title="Go to Dashboard">
            <Image
              src="/logo.png"
              alt="SNP Logo"
              width={34}
              height={34}
              className="rounded-md object-contain"
            />
            <div className="hidden sm:block">
              <p className="text-sm font-bold text-charcoal leading-tight">SNP ERP</p>
              <p className="text-[10px] text-taupe leading-tight">Shri Neminath Printers</p>
            </div>
          </Link>

          <div className="w-px h-6 bg-sand shrink-0" />

          {backHref && (
            <Link
              href={backHref}
              className="p-2 rounded-lg hover:bg-cream text-charcoal transition-colors"
            >
              <ArrowLeft size={18} />
            </Link>
          )}
          <div>
            <h1 className="text-base font-semibold text-charcoal tracking-tight leading-tight">{title}</h1>
            <p className="text-xs text-taupe">Shri Neminath Printers & Packaging</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {user && (
            <div className="text-right hidden sm:block mr-2">
              <p className="text-sm font-medium text-charcoal leading-tight">{user.username}</p>
              <p className="text-xs text-taupe capitalize">{user.role}</p>
            </div>
          )}

          <Link
            href="/activity"
            className="p-2 rounded-lg hover:bg-cream text-taupe transition-colors"
            title="Activity Center"
          >
            <Activity size={17} />
          </Link>

          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg hover:bg-cream text-taupe transition-colors"
            title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
          </button>

          <button
            onClick={logout}
            className="p-2 rounded-lg hover:bg-cream text-rust transition-colors"
            title="Logout"
          >
            <LogOut size={17} />
          </button>
        </div>
      </div>
    </header>
  );
}
