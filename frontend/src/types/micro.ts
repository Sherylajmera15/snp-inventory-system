// ─── Material Type ────────────────────────────────────────────────────────────

export type MicroMaterialType = "Plates" | "Chemicals" | "Films";
export type MicroFilmType = "Only Micro" | "Only Embossing" | "Both";

export const MICRO_PLATE_SIZES = ["838 x 1000 mm", "Other"] as const;
export type MicroPlateSize = (typeof MICRO_PLATE_SIZES)[number];

export const MICRO_FILM_TYPES: MicroFilmType[] = ["Only Micro", "Only Embossing", "Both"];

export const MICRO_RECEIVED_BY_OPTIONS = ["Navneet Mahajan", "Other"] as const;
export const MICRO_ISSUED_BY_OPTIONS = ["Nikhil", "Navneet Mahajan", "Ajit", "Other"] as const;

// ─── Item Inputs ──────────────────────────────────────────────────────────────

export interface PlateItemCreate {
  plate_size: string;
  custom_length?: number | null;
  custom_width?: number | null;
  number_of_plates: number;
}

export interface QuantityGroupInput {
  number_of_packs: number;
  quantity_per_pack: number;
  unit: string;
}

export interface ChemicalItemCreate {
  chemical_name: string;
  manufacturer?: string | null;
  quantity_groups: QuantityGroupInput[];
}

export interface FilmItemCreate {
  job_name: string;
  film_length?: number | null;
  film_width?: number | null;
  film_type: MicroFilmType;
  quantity: number;
}

// ─── Full Item Detail (returned from API) ────────────────────────────────────

export interface PlateItemDetail extends PlateItemCreate {
  id: number;
  item_number?: number | null;
}

export interface QuantityGroupOut extends QuantityGroupInput {
  group_number: number;
  group_quantity: number;
}

export interface ChemicalItemDetail {
  id: number;
  item_number: number;
  chemical_name: string;
  manufacturer?: string | null;
  quantity_groups: QuantityGroupOut[];
  item_total_quantity: number;
}

export interface FilmItemDetail extends FilmItemCreate {
  id: number;
  item_number?: number | null;
}

// ─── Inward Create / Detail ───────────────────────────────────────────────────

export interface MicroInwardCreate {
  inward_date: string;
  inward_time: string;
  supplier_name: string;
  invoice_number?: string | null;
  received_by: string;
  remarks?: string | null;
  material_type: MicroMaterialType;
  plate_items?: PlateItemCreate[];
  chemical_items?: ChemicalItemCreate[];
  film_items?: FilmItemCreate[];
}

export interface MicroInwardDetail {
  id: number;
  inward_date: string;
  inward_time: string;
  supplier_name: string;
  invoice_number?: string | null;
  received_by: string;
  remarks?: string | null;
  material_type: MicroMaterialType;
  plate_items?: PlateItemDetail[];
  chemical_items?: ChemicalItemDetail[];
  film_items?: FilmItemDetail[];
  created_by_id?: number | null;
  created_by_name?: string | null;
}

export interface MicroInwardListItem {
  id: number;
  inward_date: string;
  inward_time: string;
  supplier_name: string;
  material_type: MicroMaterialType;
  remarks?: string | null;
  item_summaries?: string[];
}

// ─── Suggestions ─────────────────────────────────────────────────────────────

export interface MicroSuggestions {
  supplier_names: string[];
  chemical_names: string[];
  manufacturers: string[];
  received_by_options: string[];
}

// ─── Outward: Plates ─────────────────────────────────────────────────────────

export interface MicroPlateStock {
  plate_size: string;
  available: number;
}

export interface MicroPlatesOutwardCreate {
  outward_date: string;
  outward_time?: string | null;
  receiver_name?: string | null;
  issued_by?: string | null;
  plate_size: string;
  number_of_plates: number;
  remarks?: string | null;
}

export interface MicroPlatesOutwardDetail {
  id: number;
  outward_date: string;
  outward_time?: string | null;
  receiver_name?: string | null;
  issued_by?: string | null;
  plate_size: string;
  number_of_plates: number;
  remarks?: string | null;
  created_by_id?: number | null;
  created_by_name?: string | null;
}

export interface MicroPlatesOutwardListItem {
  id: number;
  outward_date: string;
  outward_time?: string | null;
  receiver_name?: string | null;
  issued_by?: string | null;
  plate_size: string;
  number_of_plates: number;
  remarks?: string | null;
}

// ─── Outward: Films ──────────────────────────────────────────────────────────

export interface MicroFilmStock {
  film_length?: number | null;
  film_width?: number | null;
  film_type: MicroFilmType;
  available: number;
}

export interface MicroFilmsOutwardCreate {
  outward_date: string;
  outward_time?: string | null;
  receiver_name?: string | null;
  issued_by?: string | null;
  job_name: string;
  film_length?: number | null;
  film_width?: number | null;
  film_type?: MicroFilmType | null;
  quantity?: number | null;
  remarks?: string | null;
}

export interface MicroFilmsOutwardDetail {
  id: number;
  outward_date: string;
  outward_time?: string | null;
  receiver_name?: string | null;
  issued_by?: string | null;
  job_name: string;
  film_length?: number | null;
  film_width?: number | null;
  film_type?: MicroFilmType | null;
  quantity?: number | null;
  remarks?: string | null;
  created_by_id?: number | null;
  created_by_name?: string | null;
}

export interface MicroFilmsOutwardListItem {
  id: number;
  outward_date: string;
  outward_time?: string | null;
  receiver_name?: string | null;
  issued_by?: string | null;
  job_name: string;
  film_length?: number | null;
  film_width?: number | null;
  film_type?: MicroFilmType | null;
  quantity?: number | null;
  remarks?: string | null;
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

export interface MicroDashboard {
  plates_today: number;
  chemicals_today: number;
  films_today: number;
  plates_month: number;
  chemicals_month: number;
  films_month: number;
  plate_stock: MicroPlateStock[];
  chemical_stock: { item_name: string; unit: string; available_qty: number }[];
  film_stock: MicroFilmStock[];
  top_suppliers: { name: string; count: number }[];
}

// ─── Export ───────────────────────────────────────────────────────────────────

export interface MicroExportEntry {
  inward_date: string;
  inward_time: string;
  supplier_name: string;
  invoice_number?: string | null;
  received_by: string;
  remarks?: string | null;
  material_type: MicroMaterialType;
  plate_items?: PlateItemDetail[];
  chemical_items?: ChemicalItemDetail[];
  film_items?: FilmItemDetail[];
}

// ─── Chemical Outward (Micro) list item ──────────────────────────────────────

export interface MicroChemicalsOutwardListItem {
  id: number;
  outward_date: string;
  outward_time?: string | null;
  issued_by?: string | null;
  received_by?: string | null;
  remarks?: string | null;
  items: { item_name: string; quantity_issued: number; unit: string }[];
}
