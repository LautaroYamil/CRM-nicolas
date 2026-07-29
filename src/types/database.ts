export type UserRole = "admin" | "seller";

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | { [key: string]: JsonValue | undefined }
  | JsonValue[];

export interface Profile {
  id: string;
  full_name: string | null;
  role: UserRole;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Activity {
  id: string;
  client_id: string;
  assigned_user_id: string;
  type: string;
  status: "pendiente" | "realizada" | "cancelada";
  scheduled_at: string;
  completed_at: string | null;
  objective: string | null;
  outcome: string | null;
  rescheduled_count: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ClientStatusChange {
  id: string;
  client_id: string;
  old_status: string | null;
  new_status: string;
  changed_by: string | null;
  created_at: string;
}
