export interface PackingStockItem {
  material_type: string;
  box_size: string | null;
  display_label: string;
  unit: string;
  available_qty: number;
}

export interface PackingOutwardItemInput {
  material_type: string;
  box_size: string | null;
  quantity_issued: number;
  unit: string;
}

export interface PackingOutwardItem {
  id: number;
  material_type: string;
  box_size: string | null;
  quantity_issued: number;
  unit: string;
}

export interface PackingAdjEntry {
  id: number;
  material_type: string;
  box_size: string | null;
  quantity: number;
  unit: string;
  reason: string | null;
}

export interface PackingOutwardDetail {
  id: number;
  outward_date: string;
  outward_time: string | null;
  issued_by: string | null;
  received_by: string | null;
  remarks: string | null;
  items: PackingOutwardItem[];
  adjustments: PackingAdjEntry[];
}

export interface PackingOutwardListItem {
  id: number;
  outward_date: string;
  outward_time: string | null;
  issued_by: string | null;
  received_by: string | null;
  remarks: string | null;
  items: { material_type: string; box_size: string | null; quantity_issued: number; unit: string }[];
}

export interface PackingShortage {
  item_name: string;
  unit: string;
  available_qty: number;
  requested_qty: number;
  shortage_qty: number;
}

export interface PackingOutwardAnalytics {
  today: { total_entries: number; boxes_issued: number; plastic_kg: number; shrink_wrap_kg: number; sutli_bundles: number };
  month: { total_entries: number; boxes_issued: number; plastic_kg: number; shrink_wrap_kg: number; sutli_bundles: number };
}
