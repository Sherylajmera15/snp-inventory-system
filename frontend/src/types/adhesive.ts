export const ADHESIVE_OPTIONS = [
  "Fevicol 282",
  "Fevicol CPW",
  "Fevicol LM 51",
  "Fevicol LM 34",
  "Fevicol 2000 L",
  "Fevicol T-28",
  "Other",
] as const;

export const ADH_CHECKED_RECEIVED_BY_OPTIONS = ["NAVNEET MAHAJAN", "Other"] as const;

export interface QuantityGroupInput {
  number_of_packs: number;
  quantity_per_pack: number;
  unit: string;
}

export interface QuantityGroupOut extends QuantityGroupInput {
  group_number: number;
  group_quantity: number;
}

export interface AdhesiveItemInput {
  adhesive_name: string;
  manufacturer?: string | null;
  quantity_groups: QuantityGroupInput[];
}

export interface AdhesiveItem extends AdhesiveItemInput {
  id: number;
  item_number: number;
  quantity_groups: QuantityGroupOut[];
  item_total_quantity: number;
}

export interface AdhesiveInwardInput {
  inward_date: string;
  inward_time: string;
  supplier_name: string;
  invoice_number?: string | null;
  checked_received_by: string;
  remarks?: string | null;
  items: AdhesiveItemInput[];
}

export interface AdhesiveInwardDetail {
  id: number;
  inward_date: string;
  inward_time: string;
  supplier_name: string;
  invoice_number?: string | null;
  checked_received_by?: string | null;
  remarks?: string | null;
  items: AdhesiveItem[];
  grand_total_quantity: number;
}

export interface AdhesiveInwardListItem {
  id: number;
  inward_date: string;
  inward_time: string;
  supplier_name: string;
  remarks?: string | null;
  item_count: number;
  grand_total_quantity: number;
  item_summaries?: string[];
}

export interface AdhesiveSuggestions {
  supplier_names: string[];
  manufacturers: string[];
  custom_names: string[];
  checked_received_by: string[];
}

export type AdhesiveSuggestionCategory =
  | "supplier_name"
  | "manufacturer"
  | "custom_name"
  | "checked_received_by";
