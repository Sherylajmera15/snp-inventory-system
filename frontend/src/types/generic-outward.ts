export interface GenericStockItem {
  item_name: string;
  unit: string;
  available_qty: number;
}

export interface GenericOutwardItemInput {
  item_name: string;
  unit: string;
  quantity_issued: number;
}

export interface GenericOutwardItem {
  id: number;
  item_name: string;
  quantity_issued: number;
  unit: string;
}

export interface GenericAdjEntry {
  id: number;
  item_name: string;
  quantity: number;
  unit: string;
  reason: string | null;
}

export interface GenericOutwardDetail {
  id: number;
  outward_date: string;
  outward_time: string | null;
  issued_by: string | null;
  received_by: string | null;
  remarks: string | null;
  items: GenericOutwardItem[];
  adjustments: GenericAdjEntry[];
}

export interface GenericOutwardListItem {
  id: number;
  outward_date: string;
  outward_time: string | null;
  issued_by: string | null;
  received_by: string | null;
  remarks: string | null;
  items: { item_name: string; quantity_issued: number; unit: string }[];
}

export interface GenericStockShortage {
  item_name: string;
  unit: string;
  available_qty: number;
  requested_qty: number;
  shortage_qty: number;
}

export interface GenericOutwardAnalytics {
  today: {
    total_entries: number;
    total_items: number;
    top_consumed: { item_name: string; unit: string; total_qty: number }[];
  };
  month: {
    total_entries: number;
    total_items: number;
    top_consumed: { item_name: string; unit: string; total_qty: number }[];
  };
  top_consumed: { item_name: string; unit: string; total_qty: number }[];
  top_receivers: { received_by: string; entry_count: number }[];
}

export interface OutwardModuleConfig {
  apiPrefix: string;
  title: string;
  emoji: string;
  routeBase: string;
  searchPlaceholder: string;
}
