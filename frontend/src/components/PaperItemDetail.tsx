"use client";

import { PaperItem } from "@/types/paper";

interface PaperItemDetailProps {
  item: PaperItem;
  index: number;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-taupe uppercase tracking-wide">{label}</p>
      <p className="text-sm text-charcoal font-medium">{value}</p>
    </div>
  );
}

export default function PaperItemDetail({ item, index }: PaperItemDetailProps) {
  return (
    <div className="border border-sand rounded-2xl p-5 bg-white">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xs font-semibold uppercase tracking-wide text-rust">
          Item {index + 1}
        </span>
        <span className="text-xs px-2 py-0.5 rounded-full bg-sand text-charcoal">
          {item.form_type}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
        <Field label="Quality" value={item.quality} />
        <Field label="GSM" value={item.gsm} />
        <Field label="Form Type" value={item.form_type} />
      </div>

      {item.form_type === "Reel Form" ? (
        <div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
            <Field label="Reel Width (cm)" value={item.reel_width} />
            <Field label="Number of Reels" value={item.number_of_reels} />
            <Field
              label="Total Reel Weight (kg)"
              value={item.total_reel_weight?.toFixed(2)}
            />
          </div>
          <div>
            <p className="text-xs text-taupe uppercase tracking-wide mb-2">Individual Reel Weights (kg)</p>
            <div className="flex flex-wrap gap-2">
              {item.reel_weights?.map((w, i) => (
                <span key={i} className="text-xs px-2.5 py-1 rounded-full bg-cream border border-sand text-charcoal">
                  Reel {i + 1}: {w.toFixed(2)}
                </span>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
            <Field label="Length (cm)" value={item.sheet_length} />
            <Field label="Width (cm)" value={item.sheet_width} />
            <Field label="Total Sheets" value={item.total_sheets} />
            <Field label="Sheet Weight (kg)" value={item.sheet_weight?.toFixed(2)} />
          </div>
          <div>
            <p className="text-xs text-taupe uppercase tracking-wide mb-2">Bundle Groups</p>
            <div className="space-y-2">
              {item.bundle_groups?.map((g) => (
                <div
                  key={g.group_number}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-charcoal bg-cream/60 border border-sand rounded-lg px-3 py-2"
                >
                  <span className="text-xs font-semibold uppercase tracking-wide text-rust">
                    Group {g.group_number}
                  </span>
                  <span>{g.number_of_bundles} Bundles</span>
                  <span>×</span>
                  <span>{g.packets_per_bundle} Packets/Bundle</span>
                  <span>×</span>
                  <span>{g.sheets_per_packet} Sheets/Packet</span>
                  <span className="font-semibold">= {g.group_total_sheets} Sheets</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
