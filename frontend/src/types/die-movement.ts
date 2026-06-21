export interface ActiveDie {
  id: number;
  die_number: string;
  job_name: string;
  ups: number;
  embossing: string;
  rubberized: string;
  storage_location: string | null;
}

export interface DieMovementDetail {
  id: number;
  movement_date: string;
  movement_time: string | null;
  die_item_id: number;
  die_number: string;
  job_name: string;
  ups: number;
  embossing: string;
  rubberized: string;
  issued_to: string;
  current_location: string | null;
  issued_by: string | null;
  received_by: string | null;
  remarks: string | null;
  created_by_id?: number | null;
  created_by_name?: string | null;
}

export interface DieMovementListItem {
  id: number;
  movement_date: string;
  movement_time: string | null;
  die_number: string;
  job_name: string;
  issued_to: string;
  current_location: string | null;
  issued_by: string | null;
  received_by: string | null;
  remarks: string | null;
}

export interface DieMovementAnalytics {
  today_movements: number;
  month_movements: number;
  top_moved_dies: { die_number: string; job_name: string; movement_count: number }[];
  location_summary: { location: string; die_count: number }[];
}
