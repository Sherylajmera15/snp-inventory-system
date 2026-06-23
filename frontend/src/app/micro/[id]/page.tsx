"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import AppHeader from "@/components/AppHeader";
import DeleteConfirmModal from "@/components/DeleteConfirmModal";
import api from "@/lib/api";
import {
  MicroInwardDetail,
  MicroMaterialType,
  PlateItemDetail,
  ChemicalItemDetail,
  FilmItemDetail,
  MICRO_RECEIVED_BY_OPTIONS,
  MICRO_PLATE_SIZES,
  MICRO_FILM_TYPES,
  MicroFilmType,
  QuantityGroupInput,
} from "@/types/micro";
import { Pencil, Trash2, Plus, X } from "lucide-react";
import { isWithin24Hours } from "@/components/EditProtectionModal";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-taupe uppercase tracking-wide">{label}</p>
      <p className="text-sm text-charcoal font-medium">{value || "—"}</p>
    </div>
  );
}

function MaterialTypeBadge({ type }: { type: MicroMaterialType }) {
  const map: Record<MicroMaterialType, string> = {
    Plates: "bg-blue-100 text-blue-700 border border-blue-200",
    Chemicals: "bg-green-100 text-green-700 border border-green-200",
    Films: "bg-purple-100 text-purple-700 border border-purple-200",
  };
  return (
    <span className={`inline-block text-xs font-semibold px-2.5 py-1 rounded-full ${map[type]}`}>
      {type}
    </span>
  );
}

function PlateItemsSection({ items }: { items: PlateItemDetail[] }) {
  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-charcoal">Plate Items ({items.length})</h3>
      <div className="bg-white border border-sand rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-cream text-left text-taupe text-xs uppercase tracking-wide">
              <th className="px-5 py-3 font-medium">#</th>
              <th className="px-5 py-3 font-medium">Plate Size</th>
              <th className="px-5 py-3 font-medium">Custom Dims (mm)</th>
              <th className="px-5 py-3 font-medium">Number of Plates</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={item.id} className="border-t border-sand">
                <td className="px-5 py-3 text-taupe">{i + 1}</td>
                <td className="px-5 py-3 text-charcoal font-medium">{item.plate_size}</td>
                <td className="px-5 py-3 text-charcoal">
                  {item.plate_size === "Other" && (item.custom_length || item.custom_width)
                    ? `${item.custom_length ?? "?"} × ${item.custom_width ?? "?"}`
                    : "—"}
                </td>
                <td className="px-5 py-3 text-charcoal font-semibold">{item.number_of_plates}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ChemicalItemsSection({ items }: { items: ChemicalItemDetail[] }) {
  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-charcoal">Chemical Items ({items.length})</h3>
      {items.map((item) => (
        <div key={item.id} className="bg-white border border-sand rounded-2xl p-5">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-sm font-semibold text-charcoal">{item.chemical_name}</p>
              {item.manufacturer && (
                <p className="text-xs text-taupe mt-0.5">Mfr: {item.manufacturer}</p>
              )}
            </div>
            <span className="text-xs text-taupe">Item #{item.item_number}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-cream text-taupe text-left">
                  <th className="px-3 py-2 font-medium">Group</th>
                  <th className="px-3 py-2 font-medium"># Packs</th>
                  <th className="px-3 py-2 font-medium">Qty / Pack</th>
                  <th className="px-3 py-2 font-medium">Unit</th>
                  <th className="px-3 py-2 font-medium">Group Total</th>
                </tr>
              </thead>
              <tbody>
                {item.quantity_groups.map((g) => (
                  <tr key={g.group_number} className="border-t border-sand">
                    <td className="px-3 py-2 text-taupe">{g.group_number}</td>
                    <td className="px-3 py-2 text-charcoal">{g.number_of_packs}</td>
                    <td className="px-3 py-2 text-charcoal">{g.quantity_per_pack}</td>
                    <td className="px-3 py-2 text-charcoal">{g.unit}</td>
                    <td className="px-3 py-2 text-charcoal font-semibold">
                      {g.group_quantity} {g.unit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 text-right text-xs font-semibold text-charcoal">
            Item Total: {item.item_total_quantity}
          </div>
        </div>
      ))}
    </div>
  );
}

function FilmItemsSection({ items }: { items: FilmItemDetail[] }) {
  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-charcoal">Film Items ({items.length})</h3>
      <div className="bg-white border border-sand rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-cream text-left text-taupe text-xs uppercase tracking-wide">
              <th className="px-5 py-3 font-medium">#</th>
              <th className="px-5 py-3 font-medium">Job Name</th>
              <th className="px-5 py-3 font-medium">Length (mm)</th>
              <th className="px-5 py-3 font-medium">Width (mm)</th>
              <th className="px-5 py-3 font-medium">Film Type</th>
              <th className="px-5 py-3 font-medium">Quantity</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={item.id} className="border-t border-sand">
                <td className="px-5 py-3 text-taupe">{i + 1}</td>
                <td className="px-5 py-3 text-charcoal font-medium">{item.job_name}</td>
                <td className="px-5 py-3 text-charcoal">{item.film_length ?? "—"}</td>
                <td className="px-5 py-3 text-charcoal">{item.film_width ?? "—"}</td>
                <td className="px-5 py-3 text-charcoal">
                  <span className="text-xs bg-purple-50 text-purple-700 border border-purple-200 rounded-full px-2 py-0.5">
                    {item.film_type}
                  </span>
                </td>
                <td className="px-5 py-3 text-charcoal font-semibold">{item.quantity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Inline Edit Form ─────────────────────────────────────────────────────────

const inputClass =
  "w-full rounded-lg border border-sand bg-cream/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust";
const labelClass = "block text-sm font-medium text-charcoal mb-1";

interface PlateEditRow {
  plate_size: string;
  custom_length: string;
  custom_width: string;
  number_of_plates: string;
}
interface ChemEditRow {
  chemical_name: string;
  manufacturer: string;
  quantity_groups: { number_of_packs: string; quantity_per_pack: string; unit: string }[];
}
interface FilmEditRow {
  job_name: string;
  film_length: string;
  film_width: string;
  film_type: string;
  quantity: string;
}

function InlineEditForm({
  entry,
  onSaved,
  onCancel,
}: {
  entry: MicroInwardDetail;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [inwardDate, setInwardDate] = useState(entry.inward_date);
  const [inwardTime, setInwardTime] = useState(entry.inward_time?.slice(0, 5) || "");
  const [supplierName, setSupplierName] = useState(entry.supplier_name);
  const [invoiceNumber, setInvoiceNumber] = useState(entry.invoice_number || "");
  const [receivedBy, setReceivedBy] = useState(
    (MICRO_RECEIVED_BY_OPTIONS as readonly string[]).includes(entry.received_by)
      ? entry.received_by
      : "Other"
  );
  const [receivedByOther, setReceivedByOther] = useState(
    (MICRO_RECEIVED_BY_OPTIONS as readonly string[]).includes(entry.received_by)
      ? ""
      : entry.received_by
  );
  const [remarks, setRemarks] = useState(entry.remarks || "");

  const [plateRows, setPlateRows] = useState<PlateEditRow[]>(
    entry.plate_items?.map((p) => ({
      plate_size: p.plate_size,
      custom_length: p.custom_length != null ? String(p.custom_length) : "",
      custom_width: p.custom_width != null ? String(p.custom_width) : "",
      number_of_plates: String(p.number_of_plates),
    })) || [{ plate_size: "", custom_length: "", custom_width: "", number_of_plates: "" }]
  );

  const [chemRows, setChemRows] = useState<ChemEditRow[]>(
    entry.chemical_items?.map((c) => ({
      chemical_name: c.chemical_name,
      manufacturer: c.manufacturer || "",
      quantity_groups: c.quantity_groups.map((g) => ({
        number_of_packs: String(g.number_of_packs),
        quantity_per_pack: String(g.quantity_per_pack),
        unit: g.unit,
      })),
    })) || [{ chemical_name: "", manufacturer: "", quantity_groups: [{ number_of_packs: "", quantity_per_pack: "", unit: "" }] }]
  );

  const [filmRows, setFilmRows] = useState<FilmEditRow[]>(
    entry.film_items?.map((f) => ({
      job_name: f.job_name,
      film_length: f.film_length != null ? String(f.film_length) : "",
      film_width: f.film_width != null ? String(f.film_width) : "",
      film_type: f.film_type,
      quantity: String(f.quantity),
    })) || [{ job_name: "", film_length: "", film_width: "", film_type: "", quantity: "" }]
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    setError("");
    if (!supplierName.trim()) { setError("Supplier Name is required"); return; }
    const finalReceivedBy = receivedBy === "Other" ? receivedByOther.trim() : receivedBy;
    if (!finalReceivedBy) { setError("Received By is required"); return; }

    let plate_items: { plate_size: string; custom_length?: number | null; custom_width?: number | null; number_of_plates: number }[] | undefined;
    let chemical_items: { chemical_name: string; manufacturer?: string | null; quantity_groups: QuantityGroupInput[] }[] | undefined;
    let film_items: { job_name: string; film_length?: number | null; film_width?: number | null; film_type: MicroFilmType; quantity: number }[] | undefined;

    if (entry.material_type === "Plates") {
      plate_items = [];
      for (const r of plateRows) {
        if (!r.plate_size || !r.number_of_plates) { setError("Plate size and number of plates are required"); return; }
        const item: { plate_size: string; custom_length?: number | null; custom_width?: number | null; number_of_plates: number } = {
          plate_size: r.plate_size,
          number_of_plates: Number(r.number_of_plates),
        };
        if (r.plate_size === "Other") {
          item.custom_length = r.custom_length ? Number(r.custom_length) : null;
          item.custom_width = r.custom_width ? Number(r.custom_width) : null;
        }
        plate_items.push(item);
      }
    } else if (entry.material_type === "Chemicals") {
      chemical_items = [];
      for (const r of chemRows) {
        if (!r.chemical_name.trim()) { setError("Chemical name is required"); return; }
        const groups: QuantityGroupInput[] = [];
        for (const g of r.quantity_groups) {
          if (!g.number_of_packs || !g.quantity_per_pack || !g.unit) { setError("All quantity group fields are required"); return; }
          groups.push({ number_of_packs: Number(g.number_of_packs), quantity_per_pack: Number(g.quantity_per_pack), unit: g.unit });
        }
        chemical_items.push({ chemical_name: r.chemical_name, manufacturer: r.manufacturer || null, quantity_groups: groups });
      }
    } else if (entry.material_type === "Films") {
      film_items = [];
      for (const r of filmRows) {
        if (!r.job_name.trim()) { setError("Job name is required for all film items"); return; }
        if (!r.film_type || !r.quantity) { setError("Film type and quantity are required for all film items"); return; }
        film_items.push({
          job_name: r.job_name.trim(),
          film_length: r.film_length ? Number(r.film_length) : null,
          film_width: r.film_width ? Number(r.film_width) : null,
          film_type: r.film_type as MicroFilmType,
          quantity: Number(r.quantity),
        });
      }
    }

    setSaving(true);
    try {
      await api.put(`/api/micro/${entry.id}`, {
        inward_date: inwardDate,
        inward_time: inwardTime,
        supplier_name: supplierName.trim(),
        invoice_number: invoiceNumber.trim() || null,
        received_by: finalReceivedBy,
        remarks: remarks.trim() || null,
        material_type: entry.material_type,
        plate_items,
        chemical_items,
        film_items,
      });
      onSaved();
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { detail?: string } } }).response?.data?.detail || "Failed to save"
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-sand rounded-2xl p-5 space-y-4">
        <h3 className="font-semibold text-charcoal">Edit Entry Details</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Date</label>
            <input type="date" value={inwardDate} onChange={(e) => setInwardDate(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Time</label>
            <input type="time" value={inwardTime} onChange={(e) => setInwardTime(e.target.value)} className={inputClass} />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Supplier Name</label>
            <input type="text" value={supplierName} onChange={(e) => setSupplierName(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Invoice / Bill Number (optional)</label>
            <input type="text" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} className={inputClass} />
          </div>
        </div>
        <div>
          <label className={labelClass}>Received By</label>
          <select value={receivedBy} onChange={(e) => setReceivedBy(e.target.value)} className={inputClass}>
            {MICRO_RECEIVED_BY_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
          {receivedBy === "Other" && (
            <input type="text" value={receivedByOther} onChange={(e) => setReceivedByOther(e.target.value)}
              className={`${inputClass} mt-2`} placeholder="Enter name" />
          )}
        </div>
        <div>
          <label className={labelClass}>Remarks (optional)</label>
          <input type="text" value={remarks} onChange={(e) => setRemarks(e.target.value)} className={inputClass} />
        </div>
      </div>

      {/* Plates Edit */}
      {entry.material_type === "Plates" && (
        <div className="space-y-3">
          <h3 className="font-semibold text-charcoal">Plate Items</h3>
          {plateRows.map((row, i) => (
            <div key={i} className="bg-cream/40 border border-sand rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-charcoal">Plate Item {i + 1}</p>
                {plateRows.length > 1 && (
                  <button type="button" onClick={() => setPlateRows(plateRows.filter((_, idx) => idx !== i))}
                    className="text-taupe hover:text-rust"><X size={14} /></button>
                )}
              </div>
              <select value={row.plate_size}
                onChange={(e) => { const next = [...plateRows]; next[i] = { ...next[i], plate_size: e.target.value }; setPlateRows(next); }}
                className={inputClass}>
                <option value="" disabled>Select plate size…</option>
                {MICRO_PLATE_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              {row.plate_size === "Other" && (
                <div className="grid grid-cols-2 gap-3">
                  <input type="number" value={row.custom_length} placeholder="Length (mm)"
                    onChange={(e) => { const next = [...plateRows]; next[i] = { ...next[i], custom_length: e.target.value }; setPlateRows(next); }}
                    onWheel={(e) => e.currentTarget.blur()} className={inputClass} />
                  <input type="number" value={row.custom_width} placeholder="Width (mm)"
                    onChange={(e) => { const next = [...plateRows]; next[i] = { ...next[i], custom_width: e.target.value }; setPlateRows(next); }}
                    onWheel={(e) => e.currentTarget.blur()} className={inputClass} />
                </div>
              )}
              <input type="number" value={row.number_of_plates} placeholder="Number of plates"
                onChange={(e) => { const next = [...plateRows]; next[i] = { ...next[i], number_of_plates: e.target.value }; setPlateRows(next); }}
                onWheel={(e) => e.currentTarget.blur()} className={inputClass} />
            </div>
          ))}
          <button type="button"
            onClick={() => setPlateRows([...plateRows, { plate_size: "", custom_length: "", custom_width: "", number_of_plates: "" }])}
            className="inline-flex items-center gap-2 border border-dashed border-taupe text-taupe rounded-lg px-4 py-2.5 text-sm hover:border-rust hover:text-rust w-full justify-center">
            <Plus size={16} />Add Plate Item
          </button>
        </div>
      )}

      {/* Chemicals Edit */}
      {entry.material_type === "Chemicals" && (
        <div className="space-y-3">
          <h3 className="font-semibold text-charcoal">Chemical Items</h3>
          {chemRows.map((row, i) => (
            <div key={i} className="bg-cream/40 border border-sand rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-charcoal">Chemical Item {i + 1}</p>
                {chemRows.length > 1 && (
                  <button type="button" onClick={() => setChemRows(chemRows.filter((_, idx) => idx !== i))}
                    className="text-taupe hover:text-rust"><X size={14} /></button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input type="text" value={row.chemical_name} placeholder="Chemical name"
                  onChange={(e) => { const next = [...chemRows]; next[i] = { ...next[i], chemical_name: e.target.value }; setChemRows(next); }}
                  className={inputClass} />
                <input type="text" value={row.manufacturer} placeholder="Manufacturer (optional)"
                  onChange={(e) => { const next = [...chemRows]; next[i] = { ...next[i], manufacturer: e.target.value }; setChemRows(next); }}
                  className={inputClass} />
              </div>
              <div className="space-y-2">
                {row.quantity_groups.map((g, gi) => (
                  <div key={gi} className="flex items-center gap-2">
                    <input type="number" value={g.number_of_packs} placeholder="# packs"
                      onChange={(e) => { const next = [...chemRows]; next[i].quantity_groups[gi] = { ...next[i].quantity_groups[gi], number_of_packs: e.target.value }; setChemRows([...next]); }}
                      onWheel={(e) => e.currentTarget.blur()}
                      className="flex-1 rounded-lg border border-sand bg-cream/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust" />
                    <span className="text-taupe text-xs">×</span>
                    <input type="number" value={g.quantity_per_pack} placeholder="qty/pack"
                      onChange={(e) => { const next = [...chemRows]; next[i].quantity_groups[gi] = { ...next[i].quantity_groups[gi], quantity_per_pack: e.target.value }; setChemRows([...next]); }}
                      onWheel={(e) => e.currentTarget.blur()}
                      className="flex-1 rounded-lg border border-sand bg-cream/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust" />
                    <input type="text" value={g.unit} placeholder="unit"
                      onChange={(e) => { const next = [...chemRows]; next[i].quantity_groups[gi] = { ...next[i].quantity_groups[gi], unit: e.target.value }; setChemRows([...next]); }}
                      className="flex-1 rounded-lg border border-sand bg-cream/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust" />
                    {row.quantity_groups.length > 1 && (
                      <button type="button"
                        onClick={() => { const next = [...chemRows]; next[i].quantity_groups = next[i].quantity_groups.filter((_, j) => j !== gi); setChemRows([...next]); }}
                        className="text-taupe hover:text-rust"><X size={13} /></button>
                    )}
                  </div>
                ))}
                <button type="button"
                  onClick={() => { const next = [...chemRows]; next[i].quantity_groups.push({ number_of_packs: "", quantity_per_pack: "", unit: "" }); setChemRows([...next]); }}
                  className="text-xs text-taupe hover:text-rust">+ Add quantity group</button>
              </div>
            </div>
          ))}
          <button type="button"
            onClick={() => setChemRows([...chemRows, { chemical_name: "", manufacturer: "", quantity_groups: [{ number_of_packs: "", quantity_per_pack: "", unit: "" }] }])}
            className="inline-flex items-center gap-2 border border-dashed border-taupe text-taupe rounded-lg px-4 py-2.5 text-sm hover:border-rust hover:text-rust w-full justify-center">
            <Plus size={16} />Add Chemical Item
          </button>
        </div>
      )}

      {/* Films Edit */}
      {entry.material_type === "Films" && (
        <div className="space-y-3">
          <h3 className="font-semibold text-charcoal">Film Items</h3>
          {filmRows.map((row, i) => (
            <div key={i} className="bg-cream/40 border border-sand rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-charcoal">Film Item {i + 1}</p>
                {filmRows.length > 1 && (
                  <button type="button" onClick={() => setFilmRows(filmRows.filter((_, idx) => idx !== i))}
                    className="text-taupe hover:text-rust"><X size={14} /></button>
                )}
              </div>
              <div>
                <input type="text" value={row.job_name} placeholder="Job Name *"
                  onChange={(e) => { const next = [...filmRows]; next[i] = { ...next[i], job_name: e.target.value }; setFilmRows(next); }}
                  className={inputClass} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input type="number" value={row.film_length} placeholder="Length (mm) — optional"
                  onChange={(e) => { const next = [...filmRows]; next[i] = { ...next[i], film_length: e.target.value }; setFilmRows(next); }}
                  onWheel={(e) => e.currentTarget.blur()} className={inputClass} />
                <input type="number" value={row.film_width} placeholder="Width (mm) — optional"
                  onChange={(e) => { const next = [...filmRows]; next[i] = { ...next[i], film_width: e.target.value }; setFilmRows(next); }}
                  onWheel={(e) => e.currentTarget.blur()} className={inputClass} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <select value={row.film_type}
                  onChange={(e) => { const next = [...filmRows]; next[i] = { ...next[i], film_type: e.target.value }; setFilmRows(next); }}
                  className={inputClass}>
                  <option value="" disabled>Film Type…</option>
                  {MICRO_FILM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <input type="number" value={row.quantity} placeholder="Quantity"
                  onChange={(e) => { const next = [...filmRows]; next[i] = { ...next[i], quantity: e.target.value }; setFilmRows(next); }}
                  onWheel={(e) => e.currentTarget.blur()} className={inputClass} />
              </div>
            </div>
          ))}
          <button type="button"
            onClick={() => setFilmRows([...filmRows, { job_name: "", film_length: "", film_width: "", film_type: "", quantity: "" }])}
            className="inline-flex items-center gap-2 border border-dashed border-taupe text-taupe rounded-lg px-4 py-2.5 text-sm hover:border-rust hover:text-rust w-full justify-center">
            <Plus size={16} />Add Film Item
          </button>
        </div>
      )}

      {error && <p className="text-sm text-rust">{error}</p>}

      <div className="flex gap-3">
        <button type="button" onClick={handleSave} disabled={saving}
          className="bg-rust text-white rounded-lg px-5 py-2.5 text-sm font-medium hover:bg-rust/90 disabled:opacity-60 transition-colors">
          {saving ? "Saving..." : "Save Changes"}
        </button>
        <button type="button" onClick={onCancel}
          className="bg-white border border-sand text-charcoal rounded-lg px-5 py-2.5 text-sm font-medium hover:border-rust transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Main Detail Page ─────────────────────────────────────────────────────────

export default function MicroDetailPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [entry, setEntry] = useState<MicroInwardDetail | null>(null);
  const [fetching, setFetching] = useState(true);
  const [editing, setEditing] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  const fetchEntry = async () => {
    setFetching(true);
    try {
      const res = await api.get(`/api/micro/${id}`);
      setEntry(res.data);
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { detail?: string } } }).response?.data?.detail ||
          "Failed to load entry"
      );
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchEntry();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, id]);

  const handleDelete = async (password: string) => {
    await api.delete(`/api/micro/${id}`, { data: { password } });
    router.push("/micro");
  };

  if (loading || !user || fetching) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream">
        <p className="text-taupe">Loading...</p>
      </div>
    );
  }

  if (error || !entry) {
    return (
      <div className="min-h-screen bg-cream">
        <AppHeader title="Micro Entry" backHref="/micro" />
        <main className="max-w-3xl mx-auto px-6 py-10">
          <p className="text-rust">{error || "Entry not found"}</p>
        </main>
      </div>
    );
  }

  if (editing) {
    return (
      <div className="min-h-screen bg-cream">
        <AppHeader title="Edit Micro Inward Entry" backHref={`/micro/${id}`} />
        <main className="max-w-3xl mx-auto px-6 py-10">
          <InlineEditForm
            entry={entry}
            onSaved={() => { setEditing(false); fetchEntry(); }}
            onCancel={() => setEditing(false)}
          />
        </main>
      </div>
    );
  }

  const within24 = isWithin24Hours(entry.inward_date, entry.inward_time ?? null);
  const canEdit = user.role === "admin" || (entry.created_by_id === user.id && within24);

  return (
    <div className="min-h-screen bg-cream">
      <AppHeader title="Micro Inward Entry" backHref="/micro" />
      <main className="max-w-3xl mx-auto px-6 py-10 space-y-6">

        {/* Header card */}
        <div className="bg-white border border-sand rounded-2xl p-5 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
            <Field label="Date" value={new Date(entry.inward_date).toLocaleDateString("en-GB")} />
            <Field label="Time" value={entry.inward_time?.slice(0, 5)} />
            <Field label="Supplier Name" value={entry.supplier_name} />
            <Field label="Invoice / Bill Number" value={entry.invoice_number} />
            <Field label="Received By" value={entry.received_by} />
            <Field label="Remarks" value={entry.remarks} />
            <div>
              <p className="text-xs text-taupe uppercase tracking-wide">Material Type</p>
              <div className="mt-1">
                <MaterialTypeBadge type={entry.material_type} />
              </div>
            </div>
            {entry.created_by_name && (
              <Field label="Created By" value={entry.created_by_name} />
            )}
          </div>

          {(canEdit || user.role === "admin") && (
            <div className="flex gap-2 flex-shrink-0">
              {canEdit && (
                <button
                  onClick={() => setEditing(true)}
                  className="inline-flex items-center gap-2 bg-white border border-sand text-charcoal rounded-lg px-3 py-2 text-sm font-medium hover:border-rust transition-colors"
                >
                  <Pencil size={16} />
                  Edit
                </button>
              )}
              {user.role === "admin" && (
                <button
                  onClick={() => setShowDelete(true)}
                  className="inline-flex items-center gap-2 bg-white border border-sand text-rust rounded-lg px-3 py-2 text-sm font-medium hover:border-rust transition-colors"
                >
                  <Trash2 size={16} />
                  Delete
                </button>
              )}
            </div>
          )}
        </div>

        {/* Items section based on material type */}
        {entry.material_type === "Plates" && entry.plate_items && entry.plate_items.length > 0 && (
          <PlateItemsSection items={entry.plate_items} />
        )}
        {entry.material_type === "Chemicals" && entry.chemical_items && entry.chemical_items.length > 0 && (
          <ChemicalItemsSection items={entry.chemical_items} />
        )}
        {entry.material_type === "Films" && entry.film_items && entry.film_items.length > 0 && (
          <FilmItemsSection items={entry.film_items} />
        )}
      </main>

      {showDelete && (
        <DeleteConfirmModal onConfirm={handleDelete} onClose={() => setShowDelete(false)} />
      )}
    </div>
  );
}
