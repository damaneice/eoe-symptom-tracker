import { createMemo, createRoot, createSignal } from "solid-js";
import { createStore } from "solid-js/store";
import type { ApiState, StoredDose, StoredLog, StoredNote, StoredScope } from "../domain/api";
import { doseSchedule } from "../domain/doses";
import { progress } from "../domain/progress";
import type { IsoDate, Scope, Settings } from "../domain/types";
import type { DoseInput, LogPatch, NoteInput } from "../domain/validate";
import { api } from "./api";
import { todayIso } from "./dates";

type LoadStatus = "loading" | "ready" | "error";

const empty: ApiState = {
  settings: null,
  logs: [],
  notes: [],
  doses: [],
  scopes: [],
};

/** Everything from the API, loaded once. Screens read it; only the actions below change it. */
export const [state, setState] = createStore<ApiState>(structuredClone(empty));

export const [loadStatus, setLoadStatus] = createSignal<LoadStatus>("loading");
export const [loadError, setLoadError] = createSignal<string | null>(null);

/** Today on this device. Refreshed when the app comes back to the foreground. */
export const [today, setToday] = createSignal(todayIso());

const byDateThenId = <T extends { date: string; id?: number }>(a: T, b: T) =>
  a.date === b.date ? (a.id ?? 0) - (b.id ?? 0) : a.date < b.date ? -1 : 1;

export async function load(): Promise<void> {
  try {
    const data = await api.state();
    setState(data);
    setLoadError(null);
    setLoadStatus("ready");
  } catch (error) {
    setLoadError(error instanceof Error ? error.message : "Couldn't load your data.");
    if (loadStatus() === "loading") setLoadStatus("error");
  }
}

/** Reload when the app is reopened, so a caregiver sees what the other one logged. */
export function reloadOnReturn(): void {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    setToday(todayIso());
    void load();
  });
}

/** Derived metrics for the header and screens. Recomputed only when their inputs change. */
const derived = createRoot(() => {
  const progressMemo = createMemo(() =>
    progress({ settings: state.settings, logs: state.logs, doses: state.doses }, today()),
  );
  const scheduleMemo = createMemo(() => doseSchedule(state.doses, today()));
  return { progressMemo, scheduleMemo };
});
export const progressNow = derived.progressMemo;
export const scheduleNow = derived.scheduleMemo;

export const logFor = (date: IsoDate) => state.logs.find((l) => l.date === date);

// --- Actions. Each waits for the server, then updates the store with what it returned. ---

export async function saveSettings(settings: Settings): Promise<void> {
  setState("settings", await api.put<Settings>("/api/settings", settings));
}

export async function saveLog(date: IsoDate, patch: LogPatch): Promise<void> {
  const saved = await api.patch<StoredLog>(`/api/logs/${date}`, patch);
  setState("logs", (logs) => [...logs.filter((l) => l.date !== date), saved].sort(byDateThenId));
}

export async function deleteLog(date: IsoDate): Promise<void> {
  await api.delete(`/api/logs/${date}`);
  setState("logs", (logs) => logs.filter((l) => l.date !== date));
}

export async function addNote(note: NoteInput): Promise<void> {
  const saved = await api.post<StoredNote>("/api/notes", note);
  setState("notes", (notes) => [...notes, saved]);
}

export async function deleteNote(id: number): Promise<void> {
  await api.delete(`/api/notes/${id}`);
  setState("notes", (notes) => notes.filter((n) => n.id !== id));
}

export async function addDose(dose: DoseInput): Promise<void> {
  const saved = await api.post<StoredDose>("/api/doses", dose);
  setState("doses", (doses) => [...doses, saved].sort(byDateThenId));
}

export async function deleteDose(id: number): Promise<void> {
  await api.delete(`/api/doses/${id}`);
  setState("doses", (doses) => doses.filter((d) => d.id !== id));
}

export async function addScope(scope: Partial<Scope>): Promise<void> {
  const saved = await api.post<StoredScope>("/api/scopes", scope);
  setState("scopes", (scopes) => [...scopes, saved].sort(byDateThenId));
}

export async function deleteScope(id: number): Promise<void> {
  await api.delete(`/api/scopes/${id}`);
  setState("scopes", (scopes) => scopes.filter((s) => s.id !== id));
}
