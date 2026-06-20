export interface StockItem {
  quality: string;
  gsm: number;
  form_type: "Reel Form" | "Sheet Form";
  reel_width: number | null;
  sheet_length: number | null;
  sheet_width: number | null;
  available_qty: number;
  unit: "Kg" | "Sheets";
}

export interface OutwardItemInput {
  quality: string;
  gsm: number;
  form_type: "Reel Form" | "Sheet Form";
  reel_width?: number | null;
  sheet_length?: number | null;
  sheet_width?: number | null;
  weight_issued?: number;
  sheets_issued?: number;
  issue_method?: "sheets" | "weight";
}

export interface OutwardItem {
  id: number;
  quality: string;
  gsm: number;
  form_type: "Reel Form" | "Sheet Form";
  reel_width: number | null;
  sheet_length: number | null;
  sheet_width: number | null;
  weight_issued: number | null;
  sheets_issued: number | null;
  issue_method: string | null;
}

export interface AdjustmentEntry {
  id: number;
  quality: string;
  gsm: number;
  form_type: string;
  quantity: number;
  unit: string;
  reason: string | null;
  created_at: string | null;
}

export interface PaperOutwardDetail {
  id: number;
  outward_date: string;
  outward_time: string | null;
  job_name: string;
  job_card_number: string | null;
  issued_by: string | null;
  received_by: string | null;
  remarks: string | null;
  created_at: string | null;
  items: OutwardItem[];
  adjustments: AdjustmentEntry[];
}

export interface PaperOutwardListItem {
  id: number;
  outward_date: string;
  outward_time: string | null;
  job_name: string;
  job_card_number: string | null;
  issued_by: string | null;
  received_by: string | null;
  remarks: string | null;
  created_at: string | null;
  item_count: number;
  total_weight_issued: number;
  total_sheets_issued: number;
  item_summaries: string[];
}

export interface StockShortage {
  quality: string;
  gsm: number;
  form_type: string;
  reel_width?: number | null;
  sheet_length?: number | null;
  sheet_width?: number | null;
  unit: string;
  available: number;
  requested: number;
  shortage: number;
}

export interface OutwardAnalytics {
  today: { total_entries: number; total_reel_weight_kg: number; total_sheets: number };
  month: { total_entries: number; total_reel_weight_kg: number; total_sheets: number };
  top_consumed_qualities: { quality: string; gsm: number; form_type: string; total_weight_kg: number; total_sheets: number }[];
  top_jobs: { job_name: string; total_weight_kg: number; total_sheets: number }[];
}
