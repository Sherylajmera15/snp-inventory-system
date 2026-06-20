export const OIL_OPTIONS = [
  "Servo 68",
  "Servo 150",
  "Servo 20W-40",
  "Hydraulic Oil",
  "Gear Oil",
  "Compressor Oil",
  "Engine Oil",
  "Grease",
  "Lithium Grease",
  "Bearing Grease",
  "High Temperature Grease",
  "Other",
] as const;

export const OIL_CHECKED_RECEIVED_BY_OPTIONS = ["NAVNEET MAHAJAN", "Other"] as const;

export type OilSuggestionCategory =
  | "supplier_name"
  | "manufacturer"
  | "custom_name"
  | "machine_name"
  | "checked_received_by";

export interface OilQuantityGroupOut {
  group_number: number;
  number_of_packs: number;
  quantity_per_pack: number;
  group_quantity: number;
  unit: string;
}

export interface OilItemInput {
  oil_name: string;
  manufacturer?: string | null;
  machine_name?: string | null;
  quantity_groups: OilQuantityGroupOut[];
}

export interface OilItem {
  id: number;
  item_number: number;
  oil_name: string;
  manufacturer?: string | null;
  machine_name?: string | null;
  quantity_groups: OilQuantityGroupOut[];
  item_total_quantity: number;
}

export interface OilInwardDetail {
  id: number;
  inward_date: string;
  inward_time: string;
  supplier_name: string;
  invoice_number?: string | null;
  checked_received_by?: string | null;
  remarks?: string | null;
  items: OilItem[];
  grand_total_quantity: number;
}

export interface OilInwardListItem {
  id: number;
  inward_date: string;
  inward_time: string;
  supplier_name: string;
  remarks?: string | null;
  item_count: number;
  grand_total_quantity: number;
  item_summaries?: string[];
}

export interface OilSuggestions {
  supplier_names: string[];
  manufacturers: string[];
  custom_names: string[];
  machine_names: string[];
  checked_received_by: string[];
}
