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
  lastOpenedDate?: string | null; // e.g. "YYYY-MM-DD" in MSK
  expiresAt?: number | null; // Stored in UTC milliseconds
  useSchedule?: boolean; // Defaults to true
  pluginSettings?: Record<string, boolean>; // Plugin specific boolean capabilities
  hasFacePhoto?: boolean; // Ephemeral flag provided by plugin on read
  uiExtensions?: {
    avatarUrl?: string; // URL to override standard avatar icon
    badges?: {
      label: string;
      color: "success" | "warning" | "neutral" | "error";
    }[]; // Additional badges rendered on card
    customBlocks?: {
      title: string;
      status?: { label: string; color: "success" | "warning" | "neutral" | "error" };
      text?: string;
      subText?: string;
      imageUrl?: string;
    }[]; // Generic blocks rendered below schedule
  };
}

export interface CapabilityConfig {
  supportedRoles?: ("resident" | "guest" | "courier")[];
}
