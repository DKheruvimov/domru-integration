export interface SharedCredentials {
  login: string;
  password?: string;
  token?: string;
  refreshToken?: string;
  operatorId?: number;
  isDemo: boolean;
}

export interface ScheduleRule {
  id: string;
  days: number[]; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  startTime: string; // "18:00"
  endTime: string;   // "19:00"
}

export interface Person {
  id: string;
  name: string;
  role: "resident" | "guest" | "courier";
  enabled: boolean;
  schedules: ScheduleRule[];
  maxOpens?: number | null;
  opensRemaining?: number | null;
  expiresAt?: number | null; // Stored in UTC milliseconds
}
