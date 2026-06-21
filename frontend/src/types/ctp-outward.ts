export interface CTPStockItem {
  plate_size: string;
  available_qty: number;
}

export interface CTPOutwardItemInput {
  plate_size: string;
  quantity_issued: number;
}

export interface CTPOutwardItem {
  id: number;
  plate_size: string;
  quantity_issued: number;
}

export interface CTPAdjEntry {
  id: number;
  plate_size: string;
  quantity: number;
  reason: string | null;
  created_at: string | null;
}

export interface CTPOutwardDetail {
  id: number;
  outward_date: string;
  outward_time: string | null;
  issued_by: string | null;
  received_by: string | null;
  remarks: string | null;
  created_at: string | null;
  items: CTPOutwardItem[];
  adjustments: CTPAdjEntry[];
  created_by_id?: number | null;
  created_by_name?: string | null;
}

export interface CTPOutwardListItem {
  id: number;
  outward_date: string;
  outward_time: string | null;
  issued_by: string | null;
  received_by: string | null;
  remarks: string | null;
  created_at: string | null;
  item_count: number;
  total_plates_issued: number;
  item_summaries: string[];
}

export interface CTPStockShortage {
  plate_size: string;
  available: number;
  requested: number;
  shortage: number;
}

export interface CTPOutwardAnalytics {
  today: { total_entries: number; total_plates: number };
  month: { total_entries: number; total_plates: number };
  size_breakdown: { plate_size: string; plates_issued: number }[];
  top_receivers: { name: string; total_plates: number }[];
}
