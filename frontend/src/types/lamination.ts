export const LAMINATION_FILM_TYPES = ["PVC", "BOPP", "SILVER", "HOLOGRAPHIC", "OTHER"] as const;
export type LaminationFilmType = typeof LAMINATION_FILM_TYPES[number];

export const LAMINATION_RECEIVED_BY_OPTIONS = ["Navneet Mahajan", "Other"] as const;
export const LAMINATION_ISSUED_BY_OPTIONS = ["Nikhil", "Navneet Mahajan", "Ajit", "Other"] as const;

// Inward
export interface LaminationRollDetail {
  id: number;
  roll_number: number;
  original_weight: number;
  remaining_weight: number;
  is_consumed: boolean;
}

export interface LaminationInwardListItem {
  id: number;
  inward_date: string;
  inward_time?: string | null;
  supplier_name: string;
  invoice_number?: string | null;
  received_by: string;
  film_type: string;
  custom_type?: string | null;
  film_length?: number | null;
  film_width?: number | null;
  roll_count: number;
  total_weight: number;
  roll_weights: number[];
  remarks?: string | null;
}

export interface LaminationInwardDetail {
  id: number;
  inward_date: string;
  inward_time?: string | null;
  supplier_name: string;
  invoice_number?: string | null;
  received_by: string;
  film_type: string;
  custom_type?: string | null;
  film_length?: number | null;
  film_width?: number | null;
  remarks?: string | null;
  created_by_id?: number | null;
  created_by_name?: string | null;
  rolls: LaminationRollDetail[];
}

export interface LaminationSuggestions {
  supplier_names: string[];
}

export interface LaminationStockItem {
  film_type: string;
  custom_type?: string | null;
  film_length?: number | null;
  film_width?: number | null;
  roll_count: number;
  total_weight: number;
}

export interface LaminationDashboard {
  entries_today: number;
  weight_received_today: number;
  weight_issued_today: number;
  entries_month: number;
  weight_received_month: number;
  weight_issued_month: number;
  stock_by_type: LaminationStockItem[];
}

// Outward
export interface LaminationOutwardListItem {
  id: number;
  outward_date: string;
  outward_time?: string | null;
  receiver_name?: string | null;
  issued_by?: string | null;
  film_type: string;
  custom_type?: string | null;
  film_length?: number | null;
  film_width?: number | null;
  quantity_issued: number;
  remarks?: string | null;
}

export interface LaminationOutwardDetail {
  id: number;
  outward_date: string;
  outward_time?: string | null;
  receiver_name?: string | null;
  issued_by?: string | null;
  film_type: string;
  custom_type?: string | null;
  film_length?: number | null;
  film_width?: number | null;
  quantity_issued: number;
  remarks?: string | null;
  created_by_id?: number | null;
  created_by_name?: string | null;
  items: { id: number; roll_id: number; roll_number: number; weight_taken: number }[];
  adjustments: { id: number; film_type: string; custom_type?: string | null; quantity: number; reason?: string | null }[];
}
