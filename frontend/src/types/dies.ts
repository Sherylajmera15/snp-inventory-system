export const DIES_CHECKED_RECEIVED_BY_OPTIONS = ["NAVNEET MAHAJAN", "Other"] as const;

export type DiesSuggestionCategory =
  | "supplier_name"
  | "job_name"
  | "storage_location"
  | "checked_received_by";

export interface DieItem {
  id: number;
  item_number: number;
  die_number: string;
  job_name: string;
  ups: number;
  embossing: string;
  female_block?: string | null;
  rubberized: string;
  length?: number | null;
  width?: number | null;
  height?: number | null;
  storage_location?: string | null;
  status: "Active" | "Discontinued";
  discontinued_date?: string | null;
}

export interface DiesInwardDetail {
  id: number;
  inward_date: string;
  inward_time: string;
  supplier_name: string;
  invoice_number?: string | null;
  checked_received_by?: string | null;
  remarks?: string | null;
  items: DieItem[];
  created_by_id?: number | null;
  created_by_name?: string | null;
}

export interface DiesInwardListItem {
  id: number;
  inward_date: string;
  inward_time: string;
  supplier_name: string;
  remarks?: string | null;
  die_count: number;
  item_summaries?: string[];
}

export interface DieItemSearchResult {
  id: number;
  inward_id: number;
  inward_date: string;
  inward_time: string;
  supplier_name: string;
  die_number: string;
  job_name: string;
  ups: number;
  embossing: string;
  rubberized: string;
  status: "Active" | "Discontinued";
  storage_location?: string | null;
}

export interface DiesSuggestions {
  supplier_names: string[];
  job_names: string[];
  storage_locations: string[];
  checked_received_by: string[];
}
