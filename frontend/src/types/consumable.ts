export const CONSUMABLE_OPTIONS = [
  "Grease (Bachem)",
  "V Belt - B5",
  "Thinner",
  "Oil 68",
  "Oil 150 New",
  "M-Seal",
  "Pencil Carbon",
  "Diamond Paste Lal",
  'Brown Tape 3"',
  "Rol-O-Gel (900 Gms.)",
  "Regular Fine Powder",
  "Reaping Roll (For Packing) Shrink Wrape",
  "Sutli",
  "Press Con Sheet",
  "Dia Rubber",
  "Jelly",
  "Henkel 633-1904",
  "Ramkem Sodium Hydroxide Pellals (500 Gms.)",
  'Rubber Bend 1"',
  'Rubber Bend 2"',
  "Alpha Matrix 0.4 x 1.3 MM (Cito)",
  "Alpha Matrix 0.4 x 1.4 MM (Cito)",
  "XTC Matrix 0.8 x 2.5 MM",
  "Oil Servo 20 W-40",
  "Rubber Adhesive (Dewrite)",
  'Reimer (Emery Paper Roll) 4"',
  "Sponge",
  "IPA Alcohol",
  "TAG Belt Red Colour",
  "Ferric Chloride Anhydrous 98%",
  "Found Patti",
  "Cotton Waste",
  "Phosphoric",
  "3 Pt. Wooden Laid (Card)",
  "Fevi Kwik 203",
  "GB Fountain Solution S-3006",
  "Cutter Blade Big",
  "Other",
] as const;

export const CONS_CHECKED_RECEIVED_BY_OPTIONS = ["NAVNEET MAHAJAN", "Other"] as const;

export interface QuantityGroupInput {
  number_of_packs: number;
  quantity_per_pack: number;
  unit: string;
}

export interface QuantityGroupOut extends QuantityGroupInput {
  group_number: number;
  group_quantity: number;
}

export interface ConsumableItemInput {
  consumable_name: string;
  manufacturer?: string | null;
  quantity_groups: QuantityGroupInput[];
}

export interface ConsumableItem extends ConsumableItemInput {
  id: number;
  item_number: number;
  quantity_groups: QuantityGroupOut[];
  item_total_quantity: number;
}

export interface ConsumableInwardInput {
  inward_date: string;
  inward_time: string;
  supplier_name: string;
  invoice_number?: string | null;
  checked_received_by: string;
  remarks?: string | null;
  items: ConsumableItemInput[];
}

export interface ConsumableInwardDetail {
  id: number;
  inward_date: string;
  inward_time: string;
  supplier_name: string;
  invoice_number?: string | null;
  checked_received_by?: string | null;
  remarks?: string | null;
  items: ConsumableItem[];
  grand_total_quantity: number;
  created_by_id?: number | null;
  created_by_name?: string | null;
}

export interface ConsumableInwardListItem {
  id: number;
  inward_date: string;
  inward_time: string;
  supplier_name: string;
  remarks?: string | null;
  item_count: number;
  grand_total_quantity: number;
  item_summaries?: string[];
}

export interface ConsumableSuggestions {
  supplier_names: string[];
  manufacturers: string[];
  custom_names: string[];
  checked_received_by: string[];
}

export type ConsumableSuggestionCategory =
  | "supplier_name"
  | "manufacturer"
  | "custom_name"
  | "checked_received_by";
