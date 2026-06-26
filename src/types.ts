import type { SharedCredentials } from "../shared/types.js";
export type AppCredentials = SharedCredentials;

export interface SmartPlace {
  id: number;
  visibleAddress: string;
  subscriberName: string;
  accountId: string;
  balance: number;
  paymentPeriod: string;
}

export interface SmartDevice {
  id: number;
  name: string;
  type: string; // intercom, gate, barrier
  allowOpen: boolean;
  allowVideo: boolean;
  externalCameraId: string;
}

export interface SmartCamera {
  id: string;
  name: string;
  placeId: number;
  allowVideo: boolean;
}

export interface HistoryEvent {
  id: number;
  timestamp: string;
  eventType: string;
  title: string;
  description: string;
  deviceName: string;
  imageUrl?: string;
  sipSnapshotUrl?: string;
}

export interface GuestPin {
  id: number;
  code: string;
  name: string;
  expiresAt: string;
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
}

export interface LibraryFile {
  path: string;
  name: string;
  category: "core" | "api" | "http" | "interfaces";
}
