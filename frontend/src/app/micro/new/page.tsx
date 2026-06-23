"use client";

import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import AppHeader from "@/components/AppHeader";
import SuggestionInput from "@/components/SuggestionInput";
import api from "@/lib/api";
import {
  MicroMaterialType,
  MicroSuggestions,
  PlateItemCreate,
  ChemicalItemCreate,
  FilmItemCreate,
  QuantityGroupInput,
  MICRO_RECEIVED_BY_OPTIONS,
  MICRO_PLATE_SIZES,
  MICRO_FILM_TYPES,
  MicroFilmType,
} from "@/types/micro";
import { Plus, Trash2 } from "lucide-react";

const inputClass =
  "w-full rounded-lg border border-sand bg-cream/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust";
const labelClass = "block text-sm font-medium text-charcoal mb-1";

function getTodayDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function getCurrentTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// ─── Plate Items ──────────────────────────────────────────────────────────────

interface PlateRow {
  plate_size: string;
  custom_length: string;
  custom_width: string;
  number_of_plates: string;
}

function emptyPlateRow(): PlateRow {
  return { plate_size: "", custom_length: "", custom_width: "", number_of_plates: "" };
}

function PlateForm({
  rows,
  onChange,
}: {
  rows: PlateRow[];
  onChange: (rows: PlateRow[]) => void;
}) {
  function update(i: number, patch: Partial<PlateRow>) {
    const next = rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r));
    onChange(next);
  }
  function remove(i: number) {
    onChange(rows.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-4">
      {rows.map((row, i) => (
        <div key={i} className="bg-cream/40 border border-sand rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-charcoal uppercase tracking-wide">Plate Item {i + 1}</p>
            {rows.length > 1 && (
              <button type="button" onClick={() => remove(i)} className="text-taupe hover:text-rust transition-colors">
                <Trash2 size={14} />
              </button>
            )}
          </div>
          <div>
            <label className={labelClass}>Plate Size</label>
            <select
              value={row.plate_size}
              onChange={(e) => update(i, { plate_size: e.target.value })}
              className={inputClass}
            >
              <option value="" disabled>Select plate size…</option>
              {MICRO_PLATE_SIZES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          {row.plate_size === "Other" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Custom Length (mm)</label>
                <input
                  type="number"
                  value={row.custom_length}
                  onChange={(e) => update(i, { custom_length: e.target.value })}
                  onWheel={(e) => e.currentTarget.blur()}
                  className={inputClass}
                  placeholder="e.g. 800"
                />
              </div>
              <div>
                <label className={labelClass}>Custom Width (mm)</label>
                <input
                  type="number"
                  value={row.custom_width}
                  onChange={(e) => update(i, { custom_width: e.target.value })}
                  onWheel={(e) => e.currentTarget.blur()}
                  className={inputClass}
                  placeholder="e.g. 600"
                />
              </div>
            </div>
          )}
          <div>
            <label className={labelClass}>Number of Plates</label>
            <input
              type="number"
              min={1}
              value={row.number_of_plates}
              onChange={(e) => update(i, { number_of_plates: e.target.value })}
              onWheel={(e) => e.currentTarget.blur()}
              className={inputClass}
              placeholder="e.g. 10"
            />
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...rows, emptyPlateRow()])}
        className="inline-flex items-center gap-2 border border-dashed border-taupe text-taupe rounded-lg px-4 py-2.5 text-sm font-medium hover:border-rust hover:text-rust transition-colors w-full justify-center"
      >
        <Plus size={16} />
        {rows.length === 0 ? "Add Plate Item" : "Add Another Plate Item"}
      </button>
    </div>
  );
}

// ─── Chemical Items ───────────────────────────────────────────────────────────

interface QuantityGroupRow {
  number_of_packs: string;
  quantity_per_pack: string;
  unit: string;
}

interface ChemicalRow {
  chemical_name: string;
  manufacturer: string;
  quantityGroups: QuantityGroupRow[];
}

function emptyChemicalRow(): ChemicalRow {
  return {
    chemical_name: "",
    manufacturer: "",
    quantityGroups: [{ number_of_packs: "", quantity_per_pack: "", unit: "" }],
  };
}

const UNIT_OPTIONS = ["Litre", "ML", "KG", "Gram", "Pack", "Bottle", "Can", "Drum", "Other"];

function ChemicalForm({
  rows,
  suggestions,
  onChange,
}: {
  rows: ChemicalRow[];
  suggestions: MicroSuggestions | undefined;
  onChange: (rows: ChemicalRow[]) => void;
}) {
  const idPrefix = useId();

  function updateRow(i: number, patch: Partial<ChemicalRow>) {
    onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function updateGroup(rowIdx: number, gIdx: number, patch: Partial<QuantityGroupRow>) {
    const groups = rows[rowIdx].quantityGroups.map((g, j) => (j === gIdx ? { ...g, ...patch } : g));
    updateRow(rowIdx, { quantityGroups: groups });
  }
  function addGroup(rowIdx: number) {
    const groups = [...rows[rowIdx].quantityGroups, { number_of_packs: "", quantity_per_pack: "", unit: "" }];
    updateRow(rowIdx, { quantityGroups: groups });
  }
  function removeGroup(rowIdx: number, gIdx: number) {
    const groups = rows[rowIdx].quantityGroups.filter((_, j) => j !== gIdx);
    updateRow(rowIdx, { quantityGroups: groups });
  }
  function removeRow(i: number) {
    onChange(rows.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-4">
      {rows.map((row, i) => (
        <div key={i} className="bg-cream/40 border border-sand rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-charcoal uppercase tracking-wide">Chemical Item {i + 1}</p>
            {rows.length > 1 && (
              <button type="button" onClick={() => removeRow(i)} className="text-taupe hover:text-rust transition-colors">
                <Trash2 size={14} />
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Chemical Name</label>
              <SuggestionInput
                value={row.chemical_name}
                onChange={(v) => updateRow(i, { chemical_name: v })}
                suggestions={suggestions?.chemical_names || []}
                onRemoveSuggestion={() => {}}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Manufacturer (optional)</label>
              <SuggestionInput
                value={row.manufacturer}
                onChange={(v) => updateRow(i, { manufacturer: v })}
                suggestions={suggestions?.manufacturers || []}
                onRemoveSuggestion={() => {}}
                className={inputClass}
              />
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-medium text-taupe">Quantity Groups</p>
            {row.quantityGroups.map((g, gi) => (
              <div key={gi} className="flex items-center gap-2">
                <input
                  type="number"
                  value={g.number_of_packs}
                  onChange={(e) => updateGroup(i, gi, { number_of_packs: e.target.value })}
                  onWheel={(e) => e.currentTarget.blur()}
                  placeholder="# packs"
                  className="flex-1 rounded-lg border border-sand bg-cream/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust"
                />
                <span className="text-taupe text-xs">×</span>
                <input
                  type="number"
                  value={g.quantity_per_pack}
                  onChange={(e) => updateGroup(i, gi, { quantity_per_pack: e.target.value })}
                  onWheel={(e) => e.currentTarget.blur()}
                  placeholder="qty/pack"
                  className="flex-1 rounded-lg border border-sand bg-cream/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust"
                />
                <input
                  type="text"
                  value={g.unit}
                  onChange={(e) => updateGroup(i, gi, { unit: e.target.value })}
                  placeholder="unit"
                  list={`${idPrefix}-units-${i}-${gi}`}
                  className="flex-1 rounded-lg border border-sand bg-cream/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rust/30 focus:border-rust"
                />
                <datalist id={`${idPrefix}-units-${i}-${gi}`}>
                  {UNIT_OPTIONS.map((u) => <option key={u} value={u} />)}
                </datalist>
                {row.quantityGroups.length > 1 && (
                  <button type="button" onClick={() => removeGroup(i, gi)} className="text-taupe hover:text-rust transition-colors shrink-0">
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() => addGroup(i)}
              className="text-xs text-taupe hover:text-rust transition-colors"
            >
              + Add quantity group
            </button>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...rows, emptyChemicalRow()])}
        className="inline-flex items-center gap-2 border border-dashed border-taupe text-taupe rounded-lg px-4 py-2.5 text-sm font-medium hover:border-rust hover:text-rust transition-colors w-full justify-center"
      >
        <Plus size={16} />
        {rows.length === 0 ? "Add Chemical Item" : "Add Another Chemical Item"}
      </button>
    </div>
  );
}

// ─── Film Items ───────────────────────────────────────────────────────────────

interface FilmRow {
  job_name: string;
  film_length: string;
  film_width: string;
  film_type: MicroFilmType | "";
  quantity: string;
}

function emptyFilmRow(): FilmRow {
  return { job_name: "", film_length: "", film_width: "", film_type: "", quantity: "" };
}

function FilmForm({
  rows,
  onChange,
}: {
  rows: FilmRow[];
  onChange: (rows: FilmRow[]) => void;
}) {
  function update(i: number, patch: Partial<FilmRow>) {
    onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function remove(i: number) {
    onChange(rows.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-4">
      {rows.map((row, i) => (
        <div key={i} className="bg-cream/40 border border-sand rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-charcoal uppercase tracking-wide">Film Item {i + 1}</p>
            {rows.length > 1 && (
              <button type="button" onClick={() => remove(i)} className="text-taupe hover:text-rust transition-colors">
                <Trash2 size={14} />
              </button>
            )}
          </div>
          <div>
            <label className={labelClass}>Job Name <span className="text-rust">*</span></label>
            <input
              type="text"
              value={row.job_name}
              onChange={(e) => update(i, { job_name: e.target.value })}
              className={inputClass}
              placeholder="e.g. Job ABC"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Film Length (mm) <span className="text-taupe text-xs">(optional)</span></label>
              <input
                type="number"
                value={row.film_length}
                onChange={(e) => update(i, { film_length: e.target.value })}
                onWheel={(e) => e.currentTarget.blur()}
                className={inputClass}
                placeholder="e.g. 300"
              />
            </div>
            <div>
              <label className={labelClass}>Film Width (mm) <span className="text-taupe text-xs">(optional)</span></label>
              <input
                type="number"
                value={row.film_width}
                onChange={(e) => update(i, { film_width: e.target.value })}
                onWheel={(e) => e.currentTarget.blur()}
                className={inputClass}
                placeholder="e.g. 200"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Film Type</label>
              <select
                value={row.film_type}
                onChange={(e) => update(i, { film_type: e.target.value as MicroFilmType })}
                className={inputClass}
              >
                <option value="" disabled>Select film type…</option>
                {MICRO_FILM_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Quantity</label>
              <input
                type="number"
                min={1}
                value={row.quantity}
                onChange={(e) => update(i, { quantity: e.target.value })}
                onWheel={(e) => e.currentTarget.blur()}
                className={inputClass}
                placeholder="e.g. 5"
              />
            </div>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...rows, emptyFilmRow()])}
        className="inline-flex items-center gap-2 border border-dashed border-taupe text-taupe rounded-lg px-4 py-2.5 text-sm font-medium hover:border-rust hover:text-rust transition-colors w-full justify-center"
      >
        <Plus size={16} />
        {rows.length === 0 ? "Add Film Item" : "Add Another Film Item"}
      </button>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MicroNewPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const idPrefix = useId();

  // Header fields
  const [inwardDate, setInwardDate] = useState(getTodayDate());
  const [inwardTime, setInwardTime] = useState(getCurrentTime());
  const [supplierName, setSupplierName] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [receivedBy, setReceivedBy] = useState("");
  const [receivedByOther, setReceivedByOther] = useState("");
  const [remarks, setRemarks] = useState("");
  const [materialType, setMaterialType] = useState<MicroMaterialType | "">("");

  // Item rows
  const [plateRows, setPlateRows] = useState<PlateRow[]>([emptyPlateRow()]);
  const [chemicalRows, setChemicalRows] = useState<ChemicalRow[]>([emptyChemicalRow()]);
  const [filmRows, setFilmRows] = useState<FilmRow[]>([emptyFilmRow()]);

  const [suggestions, setSuggestions] = useState<MicroSuggestions | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  useEffect(() => {
    api
      .get<MicroSuggestions>("/api/micro/suggestions")
      .then((res) => setSuggestions(res.data))
      .catch(() => {});
  }, []);

  const handleSubmit = async () => {
    setError("");
    if (!supplierName.trim()) { setError("Supplier Name is required"); return; }
    const finalReceivedBy =
      receivedBy === "Other" ? receivedByOther.trim() : receivedBy;
    if (!finalReceivedBy) { setError("Received By is required"); return; }
    if (!materialType) { setError("Please select a Material Type"); return; }

    // Build payload
    let plate_items: PlateItemCreate[] | undefined;
    let chemical_items: ChemicalItemCreate[] | undefined;
    let film_items: FilmItemCreate[] | undefined;

    if (materialType === "Plates") {
      if (plateRows.length === 0 || !plateRows.some((r) => r.plate_size)) {
        setError("Add at least one plate item");
        return;
      }
      plate_items = [];
      for (const r of plateRows) {
        if (!r.plate_size) { setError("Plate size is required for all items"); return; }
        if (!r.number_of_plates || Number(r.number_of_plates) <= 0) {
          setError("Number of plates must be a positive number");
          return;
        }
        const item: PlateItemCreate = {
          plate_size: r.plate_size,
          number_of_plates: Number(r.number_of_plates),
        };
        if (r.plate_size === "Other") {
          if (!r.custom_length || !r.custom_width) {
            setError("Custom length and width are required for 'Other' plate size");
            return;
          }
          item.custom_length = Number(r.custom_length);
          item.custom_width = Number(r.custom_width);
        }
        plate_items.push(item);
      }
    } else if (materialType === "Chemicals") {
      if (chemicalRows.length === 0 || !chemicalRows.some((r) => r.chemical_name)) {
        setError("Add at least one chemical item");
        return;
      }
      chemical_items = [];
      for (const r of chemicalRows) {
        if (!r.chemical_name.trim()) { setError("Chemical name is required for all items"); return; }
        const groups: QuantityGroupInput[] = [];
        for (const g of r.quantityGroups) {
          if (!g.number_of_packs || !g.quantity_per_pack || !g.unit) {
            setError("All quantity group fields (# packs, qty/pack, unit) are required");
            return;
          }
          groups.push({
            number_of_packs: Number(g.number_of_packs),
            quantity_per_pack: Number(g.quantity_per_pack),
            unit: g.unit.trim(),
          });
        }
        chemical_items.push({
          chemical_name: r.chemical_name.trim(),
          manufacturer: r.manufacturer.trim() || null,
          quantity_groups: groups,
        });
      }
    } else if (materialType === "Films") {
      if (filmRows.length === 0 || !filmRows.some((r) => r.job_name)) {
        setError("Add at least one film item");
        return;
      }
      film_items = [];
      for (const r of filmRows) {
        if (!r.job_name.trim()) { setError("Job Name is required for all film items"); return; }
        if (!r.film_type) { setError("Film type is required for all items"); return; }
        if (!r.quantity || Number(r.quantity) <= 0) { setError("Quantity must be positive for all film items"); return; }
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
      const payload = {
        inward_date: inwardDate,
        inward_time: inwardTime,
        supplier_name: supplierName.trim(),
        invoice_number: invoiceNumber.trim() || null,
        received_by: finalReceivedBy,
        remarks: remarks.trim() || null,
        material_type: materialType,
        plate_items,
        chemical_items,
        film_items,
      };
      const res = await api.post("/api/micro", payload);
      router.push(`/micro/${res.data.id}`);
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { detail?: string } } }).response?.data?.detail ||
          "Failed to save entry"
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream">
        <p className="text-taupe">Loading...</p>
      </div>
    );
  }

  const MATERIAL_TYPES: MicroMaterialType[] = ["Plates", "Chemicals", "Films"];

  return (
    <div className="min-h-screen bg-cream">
      <AppHeader title="New Micro Inward Entry" backHref="/micro" />
      <main className="max-w-3xl mx-auto px-6 py-10 space-y-6">

        {/* Step 1: Header */}
        <div className="bg-white border border-sand rounded-2xl p-5 space-y-4">
          <h3 className="font-semibold text-charcoal">Inward Transaction Details</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Date</label>
              <input
                type="date"
                value={inwardDate}
                onChange={(e) => setInwardDate(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Time</label>
              <input
                type="time"
                value={inwardTime}
                onChange={(e) => setInwardTime(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Supplier Name</label>
              <SuggestionInput
                value={supplierName}
                onChange={setSupplierName}
                suggestions={suggestions?.supplier_names || []}
                onRemoveSuggestion={() => {}}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Invoice / Bill Number (optional)</label>
              <input
                type="text"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Received By</label>
            <select
              value={receivedBy}
              onChange={(e) => setReceivedBy(e.target.value)}
              className={inputClass}
            >
              <option value="" disabled>Select…</option>
              {MICRO_RECEIVED_BY_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
            {receivedBy === "Other" && (
              <div className="mt-2">
                <input
                  type="text"
                  value={receivedByOther}
                  onChange={(e) => setReceivedByOther(e.target.value)}
                  className={inputClass}
                  placeholder="Enter name"
                  list={`${idPrefix}-received-by-datalist`}
                />
                <datalist id={`${idPrefix}-received-by-datalist`}>
                  {(suggestions?.received_by_options || []).map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
              </div>
            )}
          </div>

          <div>
            <label className={labelClass}>Remarks (optional)</label>
            <input
              type="text"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        {/* Step 2: Material Type selector */}
        <div className="bg-white border border-sand rounded-2xl p-5 space-y-4">
          <h3 className="font-semibold text-charcoal">Material Type</h3>
          <div className="flex flex-wrap gap-3">
            {MATERIAL_TYPES.map((t) => {
              const colors: Record<MicroMaterialType, string> = {
                Plates: "border-blue-300 bg-blue-50 text-blue-700",
                Chemicals: "border-green-300 bg-green-50 text-green-700",
                Films: "border-purple-300 bg-purple-50 text-purple-700",
              };
              const active = materialType === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setMaterialType(t)}
                  className={`px-5 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all ${
                    active
                      ? colors[t]
                      : "border-sand bg-white text-taupe hover:border-rust hover:text-rust"
                  }`}
                >
                  {t}
                </button>
              );
            })}
          </div>
        </div>

        {/* Step 2 dynamic form */}
        {materialType === "Plates" && (
          <div className="space-y-3">
            <h3 className="font-semibold text-charcoal">Plate Items</h3>
            <PlateForm rows={plateRows} onChange={setPlateRows} />
          </div>
        )}

        {materialType === "Chemicals" && (
          <div className="space-y-3">
            <h3 className="font-semibold text-charcoal">Chemical Items</h3>
            <ChemicalForm rows={chemicalRows} suggestions={suggestions} onChange={setChemicalRows} />
          </div>
        )}

        {materialType === "Films" && (
          <div className="space-y-3">
            <h3 className="font-semibold text-charcoal">Film Items</h3>
            <FilmForm rows={filmRows} onChange={setFilmRows} />
          </div>
        )}

        {error && <p className="text-sm text-rust">{error}</p>}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="bg-rust text-white rounded-lg px-5 py-2.5 text-sm font-medium hover:bg-rust/90 transition-colors disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save Entry"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/micro")}
            className="bg-white border border-sand text-charcoal rounded-lg px-5 py-2.5 text-sm font-medium hover:border-rust transition-colors"
          >
            Cancel
          </button>
        </div>
      </main>
    </div>
  );
}
