export const PLATE_SIZE_OPTIONS = ["770 x 1030 mm", "800 x 1030 mm", "Other"] as const;

export const CTP_CHECKED_RECEIVED_BY_OPTIONS = ["NAVNEET MAHAJAN", "Other"] as const;

export interface PlateSizeInput {
  plate_size: string;
  length_mm?: number | null;
  width_mm?: number | null;
  total_packets: number;
  plates_per_packet: number;
}

export interface PlateSize extends PlateSizeInput {
  size_number: number;
  length_mm: number;
  width_mm: number;
  total_plates: number;
}

export interface CTPInwardInput {
  inward_date: string;
  inward_time: string;
  supplier_name: string;
  invoice_number?: string | null;
  checked_received_by: string;
  remarks?: string | null;
  plate_sizes: PlateSizeInput[];
}

export interface CTPInwardDetail extends CTPInwardInput {
  id: number;
  plate_sizes: PlateSize[];
  grand_total_plates: number;
}

export interface CTPInwardListItem {
  id: number;
  inward_date: string;
  inward_time: string;
  supplier_name: string;
  invoice_number?: string | null;
  remarks?: string | null;
  plate_size_count: number;
  grand_total_plates: number;
  item_summaries?: string[];
}

export interface CTPSuggestions {
  supplier_names: string[];
  checked_received_by: string[];
}

export type CTPSuggestionCategory = "supplier_name" | "checked_received_by";
