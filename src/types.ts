import type { SharedCredentials, Person, ScheduleRule } from "../shared/types.js";
export type AppCredentials = SharedCredentials;
export type { Person, ScheduleRule };

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
  openedByOurService?: {
    type: "manual" | "auto";
    details: string;
  };
}

export interface GuestPin {
  id: number;
  code: string;
  name: string;
  expiresAt: string;
}

// Person and ScheduleRule imported from shared

export interface LibraryFile {
  path: string;
  name: string;
  category: "core" | "api" | "http" | "interfaces";
}
