export type WorkType = "Self Work" | "Job Work";
export type FormType = "Reel Form" | "Sheet Form";

export const QUALITY_OPTIONS = [
  "Greyback",
  "Whiteback",
  "FBB",
  "Saffire XL",
  "Polycoated",
  "Maplitho",
  "Sticker Sheet",
  "Other",
] as const;

export const CHECKED_RECEIVED_BY_OPTIONS = ["NAVNEET MAHAJAN", "Other"] as const;

export interface BundleGroupInput {
  number_of_bundles: number;
  packets_per_bundle: number;
  sheets_per_packet: number;
}

export interface BundleGroup extends BundleGroupInput {
  group_number: number;
  group_total_sheets: number;
}

export interface PaperItemInput {
  quality: string;
  gsm: number;
  form_type: FormType;

  reel_width?: number | null;
  reel_weights?: number[] | null;

  sheet_length?: number | null;
  sheet_width?: number | null;
  bundle_groups?: BundleGroupInput[] | null;
}

export interface PaperItem extends PaperItemInput {
  id: number;
  number_of_reels?: number | null;
  total_reel_weight?: number | null;
  total_sheets?: number | null;
  sheet_weight?: number | null;
  bundle_groups?: BundleGroup[];
}

export interface PaperSuggestions {
  supplier_names: string[];
  customer_names: string[];
  qualities: string[];
  gsm_values: number[];
  checked_received_by: string[];
}

export type SuggestionCategory =
  | "supplier_name"
  | "customer_name"
  | "quality"
  | "gsm"
  | "checked_received_by";

export interface PaperInwardInput {
  inward_date: string;
  inward_time?: string | null;
  supplier_name: string;
  invoice_number?: string | null;
  work_type: WorkType;
  customer_name?: string | null;
  checked_received_by: string;
  remarks?: string | null;
  items: PaperItemInput[];
}

export interface PaperInwardDetail extends Omit<PaperInwardInput, "work_type" | "checked_received_by"> {
  id: number;
  work_type?: WorkType | null;
  checked_received_by?: string | null;
  items: PaperItem[];
  created_by_id?: number | null;
  created_by_name?: string | null;
}

export interface PaperInwardListItem {
  id: number;
  inward_date: string;
  inward_time?: string | null;
  supplier_name: string;
  invoice_number?: string | null;
  work_type?: WorkType | null;
  customer_name?: string | null;
  checked_received_by?: string | null;
  remarks?: string | null;
  item_count: number;
  item_summaries?: string[];
}
