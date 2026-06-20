export const CHEMICAL_OPTIONS = [
  "Keep Gum (Plant Protection)",
  "Instakleen UV (Plate Care)",
  "Blanket Repairing Gel (250 Gms.)",
  "Colourclean Paste (250 Gms.)",
  "Deepkleen Shampoo (500 ML)",
  "Fount System Cleaner (Press Care)",
  "Unifin Protection Gum",
  "Plate Cleaner GP",
  "Viostar UV Replenisher",
  "Ultra Pure Wash (Press Wash)",
  "Metkleen Roller Care",
  "Ankor Gold",
  "Nova Press Wash DP",
  "Viostar UD Developer",
  "Viostar Delete (100 ML)",
  "Other",
] as const;

export const CHEM_CHECKED_RECEIVED_BY_OPTIONS = ["NAVNEET MAHAJAN", "Other"] as const;

export interface QuantityGroupInput {
  number_of_packs: number;
  quantity_per_pack: number;
  unit: string;
}

export interface QuantityGroupOut extends QuantityGroupInput {
  group_number: number;
  group_quantity: number;
}

export interface ChemicalItemInput {
  chemical_name: string;
  manufacturer?: string | null;
  quantity_groups: QuantityGroupInput[];
}

export interface ChemicalItem extends ChemicalItemInput {
  id: number;
  item_number: number;
  quantity_groups: QuantityGroupOut[];
  item_total_quantity: number;
}

export interface ChemicalInwardInput {
  inward_date: string;
  inward_time: string;
  supplier_name: string;
  invoice_number?: string | null;
  checked_received_by: string;
  remarks?: string | null;
  items: ChemicalItemInput[];
}

export interface ChemicalInwardDetail {
  id: number;
  inward_date: string;
  inward_time: string;
  supplier_name: string;
  invoice_number?: string | null;
  checked_received_by?: string | null;
  remarks?: string | null;
  items: ChemicalItem[];
  grand_total_quantity: number;
}

export interface ChemicalInwardListItem {
  id: number;
  inward_date: string;
  inward_time: string;
  supplier_name: string;
  remarks?: string | null;
  item_count: number;
  grand_total_quantity: number;
  item_summaries?: string[];
}

export interface ChemicalSuggestions {
  supplier_names: string[];
  manufacturers: string[];
  custom_names: string[];
  checked_received_by: string[];
}

export type ChemicalSuggestionCategory =
  | "supplier_name"
  | "manufacturer"
  | "custom_name"
  | "checked_received_by";
