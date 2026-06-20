export const ITEM_TYPE_OPTIONS = ["UV Ink", "Conventional Ink"] as const;
export type ItemType = (typeof ITEM_TYPE_OPTIONS)[number];

export const CATEGORY_OPTIONS = ["Ink", "Varnish"] as const;
export type Category = (typeof CATEGORY_OPTIONS)[number];

export const UV_INK_COLORS = ["Cyan", "Magenta", "Yellow", "Black", "White", "Spot/Pantone"] as const;
export const CONVENTIONAL_INK_COLORS = ["Cyan", "Magenta", "Yellow", "Black", "Spot/Pantone"] as const;

export const UV_VARNISH_TYPES = ["Full UV", "Texture UV", "Matte Ink", "Matte UV", "Other"] as const;
export const CONVENTIONAL_VARNISH_TYPES = [
  "Waterbase Gloss",
  "Waterbase Matte",
  "Waterbase Primer",
  "Matpet Primer",
  "Other",
] as const;

export const INK_CHECKED_RECEIVED_BY_OPTIONS = ["NAVNEET MAHAJAN", "Other"] as const;

export interface BoxGroupInput {
  number_of_boxes: number;
  containers_per_box: number;
  weight_per_container: number;
}

export interface BoxGroup extends BoxGroupInput {
  group_number: number;
  group_weight: number;
}

export interface InkItemInput {
  item_type: ItemType;
  category: Category;
  color?: string | null;
  pantone_number?: string | null;
  varnish_type?: string | null;
  box_groups: BoxGroupInput[];
}

export interface InkItem extends InkItemInput {
  id: number;
  item_number: number;
  box_groups: BoxGroup[];
  item_total_weight: number;
}

export interface InkInwardInput {
  inward_date: string;
  inward_time: string;
  supplier_name: string;
  invoice_number?: string | null;
  checked_received_by: string;
  remarks?: string | null;
  items: InkItemInput[];
}

export interface InkInwardDetail extends Omit<InkInwardInput, "checked_received_by"> {
  id: number;
  checked_received_by?: string | null;
  items: InkItem[];
  grand_total_weight: number;
}

export interface InkInwardListItem {
  id: number;
  inward_date: string;
  inward_time: string;
  supplier_name: string;
  invoice_number?: string | null;
  remarks?: string | null;
  item_count: number;
  grand_total_weight: number;
  item_summaries?: string[];
}

export interface InkSuggestions {
  supplier_names: string[];
  pantone_numbers: string[];
  varnish_types: string[];
  checked_received_by: string[];
}

export type InkSuggestionCategory =
  | "supplier_name"
  | "pantone_number"
  | "varnish_type"
  | "checked_received_by";
