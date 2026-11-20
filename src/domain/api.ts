import type { DailyLog, Dose, Scope, Settings, TrackerEvent } from "./types";

/** Shapes the API sends and receives, shared by the Worker and the frontend. */

export interface StoredLog extends DailyLog {
  updatedBy: string;
  updatedAt: string;
}

export interface StoredNote {
  id: number;
  date: string;
  text: string;
  author: string;
  createdAt: string;
}

export interface StoredDose extends Dose {
  id: number;
  createdBy: string;
}

export interface StoredScope extends Scope {
  id: number;
}

export interface StoredEvent extends TrackerEvent {
  id: number;
  createdBy: string;
}

/** What `GET /api/state` returns: everything the app needs, loaded at once. */
export interface ApiState {
  settings: Settings | null;
  logs: StoredLog[];
  notes: StoredNote[];
  doses: StoredDose[];
  scopes: StoredScope[];
  events: StoredEvent[];
}

/** The body of a 400 response. */
export interface InvalidResponse {
  error: "Invalid";
  fields: Record<string, string>;
}
