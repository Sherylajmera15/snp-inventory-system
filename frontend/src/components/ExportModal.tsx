"use client";

import { useState } from "react";
import { X, FileText, Table2, Loader2 } from "lucide-react";

type RangeOption = "today" | "week" | "month" | "alltime" | "custom";

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  moduleName: string;
  onExport: (format: "pdf" | "excel", dateFrom: string, dateTo: string, rangeLabel: string) => Promise<void>;
}

function getDateRange(option: RangeOption, customFrom: string, customTo: string): { from: string; to: string; label: string } {
  const pad = (n: number) => String(n).padStart(2, "0");
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (option === "today") {
    const s = fmt(today);
    return { from: s, to: s, label: `Today (${s})` };
  }
  if (option === "week") {
    const day = today.getDay();
    const mon = new Date(today);
    mon.setDate(today.getDate() - ((day + 6) % 7));
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    return { from: fmt(mon), to: fmt(sun), label: `This Week (${fmt(mon)} to ${fmt(sun)})` };
  }
  if (option === "month") {
    const first = new Date(today.getFullYear(), today.getMonth(), 1);
    const last = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return { from: fmt(first), to: fmt(last), label: `This Month (${fmt(first)} to ${fmt(last)})` };
  }
  if (option === "alltime") {
    return { from: "", to: "", label: "All Time" };
  }
  return { from: customFrom, to: customTo, label: `${customFrom} to ${customTo}` };
}

export default function ExportModal({ isOpen, onClose, moduleName, onExport }: ExportModalProps) {
  const [range, setRange] = useState<RangeOption>("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [exporting, setExporting] = useState(false);

  if (!isOpen) return null;

  const handleExport = async (format: "pdf" | "excel") => {
    if (range === "custom" && (!customFrom || !customTo)) return;
    const { from, to, label } = getDateRange(range, customFrom, customTo);
    setExporting(true);
    try {
      await onExport(format, from, to, label);
    } finally {
      setExporting(false);
    }
  };

  const rangeOptions: { value: RangeOption; label: string }[] = [
    { value: "today", label: "Today" },
    { value: "week", label: "This Week" },
    { value: "month", label: "This Month" },
    { value: "alltime", label: "All Time" },
    { value: "custom", label: "Custom Range" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl border border-sand shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-sand">
          <h2 className="text-base font-semibold text-charcoal">Export {moduleName}</h2>
          <button onClick={onClose} className="text-taupe hover:text-charcoal transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          <div>
            <p className="text-xs font-semibold text-taupe uppercase tracking-wide mb-3">Select Date Range</p>
            <div className="space-y-2">
              {rangeOptions.map((opt) => (
                <label key={opt.value} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="range"
                    value={opt.value}
                    checked={range === opt.value}
                    onChange={() => setRange(opt.value)}
                    className="accent-rust"
                  />
                  <span className="text-sm text-charcoal">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          {range === "custom" && (
            <div className="grid grid-cols-2 gap-3 pl-5">
              <div>
                <label className="block text-xs text-taupe mb-1">From</label>
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="w-full rounded-lg border border-sand bg-cream/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust"
                />
              </div>
              <div>
                <label className="block text-xs text-taupe mb-1">To</label>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="w-full rounded-lg border border-sand bg-cream/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust"
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 px-6 py-4 border-t border-sand bg-cream/30 rounded-b-2xl">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 text-sm text-taupe border border-sand rounded-lg hover:bg-cream transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => handleExport("excel")}
            disabled={exporting || (range === "custom" && (!customFrom || !customTo))}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {exporting ? <Loader2 size={14} className="animate-spin" /> : <Table2 size={14} />}
            Excel
          </button>
          <button
            onClick={() => handleExport("pdf")}
            disabled={exporting || (range === "custom" && (!customFrom || !customTo))}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium bg-rust text-white rounded-lg hover:bg-rust/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {exporting ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
            PDF
          </button>
        </div>
      </div>
    </div>
  );
}
