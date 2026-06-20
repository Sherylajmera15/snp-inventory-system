"use client";

import Link from "next/link";
import { LucideIcon } from "lucide-react";

interface DashboardCardProps {
  title: string;
  icon: LucideIcon;
  href?: string;
}

export default function DashboardCard({ title, icon: Icon, href }: DashboardCardProps) {
  const content = (
    <div
      className={`group rounded-2xl border border-sand bg-white p-6 flex flex-col items-start gap-4 transition-all ${
        href ? "hover:border-rust hover:shadow-md cursor-pointer" : "opacity-50 cursor-not-allowed"
      }`}
    >
      <div
        className={`rounded-xl p-3 ${
          href ? "bg-rust/10 text-rust" : "bg-sand text-taupe"
        }`}
      >
        <Icon size={22} />
      </div>
      <div>
        <h3 className="font-medium text-charcoal">{title}</h3>
        {!href && <p className="text-xs text-taupe mt-1">Coming soon</p>}
      </div>
    </div>
  );

  if (!href) return content;

  return <Link href={href}>{content}</Link>;
}
