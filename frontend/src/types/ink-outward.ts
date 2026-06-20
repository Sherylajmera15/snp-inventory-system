export interface InkStockItem {
  item_type: string;
  category: "Ink" | "Varnish";
  color: string | null;
  pantone_number: string | null;
  varnish_type: string | null;
  available_weight_kg: number;
  available_containers: number;
}

export interface InkOutwardItemInput {
  item_type: string;
  category: string;
  color: string | null;
  pantone_number: string | null;
  varnish_type: string | null;
  containers_issued: number;
  weight_per_container: number;
}

export interface InkOutwardItem {
  id: number;
  item_type: string;
  category: string;
  color: string | null;
  pantone_number: string | null;
  varnish_type: string | null;
  containers_issued: number;
  weight_per_container: number;
  total_weight_issued: number;
}

export interface InkAdjEntry {
  id: number;
  item_type: string;
  category: string;
  color: string | null;
  pantone_number: string | null;
  varnish_type: string | null;
  quantity_kg: number;
  reason: string | null;
  created_at: string | null;
}

export interface InkOutwardDetail {
  id: number;
  outward_date: string;
  outward_time: string | null;
  job_name: string | null;
  job_card_number: string | null;
  issued_by: string | null;
  received_by: string | null;
  remarks: string | null;
  created_at: string | null;
  items: InkOutwardItem[];
  adjustments: InkAdjEntry[];
}

export interface InkOutwardListItem {
  id: number;
  outward_date: string;
  outward_time: string | null;
  job_name: string | null;
  job_card_number: string | null;
  issued_by: string | null;
  received_by: string | null;
  remarks: string | null;
  created_at: string | null;
  item_count: number;
  total_weight_issued: number;
  item_summaries: string[];
}

export interface InkStockShortage {
  item_type: string;
  category: string;
  color: string | null;
  pantone_number: string | null;
  varnish_type: string | null;
  available_kg: number;
  requested_kg: number;
  shortage_kg: number;
}

export interface InkOutwardAnalytics {
  today: { total_entries: number; total_ink_kg: number; total_varnish_kg: number };
  month: { total_entries: number; total_ink_kg: number; total_varnish_kg: number };
  color_breakdown: { label: string; total_kg: number }[];
  varnish_breakdown: { label: string; total_kg: number }[];
  top_consumed: { label: string; total_kg: number }[];
}
