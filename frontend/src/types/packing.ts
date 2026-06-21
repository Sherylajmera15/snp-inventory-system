export const PACKING_MATERIAL_OPTIONS = [
  "Printed Corrugated Boxes",
  "Sutli",
  "Plastic Roll",
  "Shrink Wrap Film",
  "Other",
] as const;

export type PackingMaterialType = (typeof PACKING_MATERIAL_OPTIONS)[number];

export const PM_CHECKED_RECEIVED_BY_OPTIONS = ["NAVNEET MAHAJAN", "Other"] as const;

export type PMSuggestionCategory = "supplier_name" | "custom_name" | "checked_received_by";

export interface BoxSizeOut {
  size_number: number;
  length: number;
  width: number;
  height: number;
  num_boxes: number;
}

export interface SutliGroupOut {
  group_number: number;
  bundle_quantity: number;
}

export interface RollWeightOut {
  roll_number: number;
  weight: number;
}

export interface PMQuantityGroupOut {
  group_number: number;
  number_of_packs: number;
  quantity_per_pack: number;
  group_quantity: number;
  unit: string;
}

export interface PackingMaterialItemOut {
  id: number;
  item_number: number;
  material_type: PackingMaterialType;
  custom_name?: string | null;
  box_sizes?: BoxSizeOut[] | null;
  sutli_groups?: SutliGroupOut[] | null;
  roll_weights?: RollWeightOut[] | null;
  quantity_groups?: PMQuantityGroupOut[] | null;
  item_total_quantity: number;
}

export interface PackingMaterialDetail {
  id: number;
  inward_date: string;
  inward_time: string;
  supplier_name: string;
  invoice_number?: string | null;
  checked_received_by?: string | null;
  remarks?: string | null;
  items: PackingMaterialItemOut[];
  grand_total_quantity: number;
  created_by_id?: number | null;
  created_by_name?: string | null;
}

export interface PackingMaterialListItem {
  id: number;
  inward_date: string;
  inward_time: string;
  supplier_name: string;
  remarks?: string | null;
  item_count: number;
  item_summaries?: string[];
}

export interface PackingSuggestions {
  supplier_names: string[];
  custom_names: string[];
  checked_received_by: string[];
}
