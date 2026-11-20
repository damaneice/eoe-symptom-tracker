import type {
  DailyLog,
  Dose,
  EventType,
  IsoDate,
  Scope,
  Settings,
  SideEffect,
  Site,
  TrackerEvent,
} from "../src/domain/types";
import type { DoseInput, LogPatch, NoteInput } from "../src/domain/validate";

interface SettingsRow {
  patient_name: string;
  first_dose: string | null;
  interval_days: 7 | 14;
  dose_mg: number;
}

export async function getSettings(db: D1Database): Promise<Settings | null> {
  const row = await db.prepare("SELECT * FROM settings WHERE id = 1").first<SettingsRow>();
  return row
    ? {
        patientName: row.patient_name,
        firstDose: row.first_dose,
        intervalDays: row.interval_days,
        doseMg: row.dose_mg,
      }
    : null;
}

export async function putSettings(db: D1Database, s: Settings): Promise<void> {
  await db
    .prepare(
      `INSERT INTO settings (id, patient_name, first_dose, interval_days, dose_mg)
       VALUES (1, ?1, ?2, ?3, ?4)
       ON CONFLICT (id) DO UPDATE SET
         patient_name = ?1, first_dose = ?2, interval_days = ?3, dose_mg = ?4`,
    )
    .bind(s.patientName, s.firstDose, s.intervalDays, s.doseMg)
    .run();
}

export interface StoredLog extends DailyLog {
  updatedBy: string;
  updatedAt: string;
}

interface LogRow {
  date: string;
  swallow: number;
  chest: number;
  abdo: number;
  vomit: number;
  impaction: number;
  eating: number;
  sleep: number;
  overall: number | null;
  updated_by: string;
  updated_at: string;
}

const toLog = (row: LogRow): StoredLog => ({
  date: row.date,
  swallow: row.swallow,
  chest: row.chest,
  abdo: row.abdo,
  vomit: row.vomit,
  impaction: row.impaction === 1,
  eating: row.eating === 1,
  sleep: row.sleep === 1,
  overall: row.overall,
  updatedBy: row.updated_by,
  updatedAt: row.updated_at,
});

/** Column for each patchable field. Only these names ever reach the SQL. */
const LOG_COLUMNS: Record<keyof LogPatch, string> = {
  swallow: "swallow",
  chest: "chest",
  abdo: "abdo",
  vomit: "vomit",
  impaction: "impaction",
  eating: "eating",
  sleep: "sleep",
  overall: "overall",
};

export async function listLogs(db: D1Database): Promise<StoredLog[]> {
  const { results } = await db.prepare("SELECT * FROM daily_logs ORDER BY date").all<LogRow>();
  return results.map(toLog);
}

/**
 * Saves only the fields in `patch`. A new day starts with the table defaults (every symptom at
 * 0), so two caregivers saving different fields of the same day don't overwrite each other.
 */
export async function patchLog(
  db: D1Database,
  date: IsoDate,
  patch: LogPatch,
  email: string,
): Promise<StoredLog> {
  const fields = Object.keys(patch) as (keyof LogPatch)[];
  const columns = fields.map((f) => LOG_COLUMNS[f]);
  const values = fields.map((f) => {
    const value = patch[f];
    return typeof value === "boolean" ? (value ? 1 : 0) : value;
  });

  const all = ["date", ...columns, "updated_by", "updated_at"];
  const updates = [...columns, "updated_by", "updated_at"].map((c) => `${c} = excluded.${c}`);
  const row = await db
    .prepare(
      `INSERT INTO daily_logs (${all.join(", ")}) VALUES (${all.map(() => "?").join(", ")})
       ON CONFLICT (date) DO UPDATE SET ${updates.join(", ")}
       RETURNING *`,
    )
    .bind(date, ...values, email, new Date().toISOString())
    .first<LogRow>();
  return toLog(row!);
}

/** Returns whether a day was deleted. */
export async function deleteLog(db: D1Database, date: IsoDate): Promise<boolean> {
  const { meta } = await db.prepare("DELETE FROM daily_logs WHERE date = ?").bind(date).run();
  return meta.changes > 0;
}

/** Tables whose rows are deleted by id. Only these names ever reach the SQL. */
export type IdTable = "day_notes" | "doses" | "scopes" | "events";

/** Returns whether a row was deleted. */
export async function deleteById(db: D1Database, table: IdTable, id: number): Promise<boolean> {
  const { meta } = await db.prepare(`DELETE FROM ${table} WHERE id = ?`).bind(id).run();
  return meta.changes > 0;
}

export interface StoredNote extends NoteInput {
  id: number;
  author: string;
  createdAt: string;
}

interface NoteRow {
  id: number;
  date: string;
  text: string;
  author: string;
  created_at: string;
}

const toNote = (row: NoteRow): StoredNote => ({
  id: row.id,
  date: row.date,
  text: row.text,
  author: row.author,
  createdAt: row.created_at,
});

export async function listNotes(db: D1Database): Promise<StoredNote[]> {
  const { results } = await db
    .prepare("SELECT * FROM day_notes ORDER BY date, created_at, id")
    .all<NoteRow>();
  return results.map(toNote);
}

export async function addNote(db: D1Database, note: NoteInput, email: string): Promise<StoredNote> {
  const row = await db
    .prepare(
      "INSERT INTO day_notes (date, text, author, created_at) VALUES (?, ?, ?, ?) RETURNING *",
    )
    .bind(note.date, note.text, email, new Date().toISOString())
    .first<NoteRow>();
  return toNote(row!);
}

export interface StoredDose extends Dose {
  id: number;
  createdBy: string;
}

interface DoseRow {
  id: number;
  date: string;
  mg: number;
  interval_days: number;
  site: Site;
  side_effect: SideEffect;
  note: string;
  created_by: string;
}

const toDose = (row: DoseRow): StoredDose => ({
  id: row.id,
  date: row.date,
  mg: row.mg,
  intervalDays: row.interval_days,
  site: row.site,
  sideEffect: row.side_effect,
  note: row.note,
  createdBy: row.created_by,
});

export async function listDoses(db: D1Database): Promise<StoredDose[]> {
  const { results } = await db.prepare("SELECT * FROM doses ORDER BY date, id").all<DoseRow>();
  return results.map(toDose);
}

export async function addDose(
  db: D1Database,
  dose: DoseInput,
  intervalDays: number,
  email: string,
): Promise<StoredDose> {
  const row = await db
    .prepare(
      `INSERT INTO doses (date, mg, interval_days, site, side_effect, note, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING *`,
    )
    .bind(dose.date, dose.mg, intervalDays, dose.site, dose.sideEffect, dose.note, email)
    .first<DoseRow>();
  return toDose(row!);
}

export interface StoredScope extends Scope {
  id: number;
}

interface ScopeRow {
  id: number;
  date: string;
  peak_eos_hpf: number;
  proximal_eos_hpf: number | null;
  mid_eos_hpf: number | null;
  distal_eos_hpf: number | null;
  findings: string;
}

const toScope = (row: ScopeRow): StoredScope => ({
  id: row.id,
  date: row.date,
  peakEosHpf: row.peak_eos_hpf,
  proximalEosHpf: row.proximal_eos_hpf,
  midEosHpf: row.mid_eos_hpf,
  distalEosHpf: row.distal_eos_hpf,
  findings: row.findings,
});

export async function listScopes(db: D1Database): Promise<StoredScope[]> {
  const { results } = await db.prepare("SELECT * FROM scopes ORDER BY date, id").all<ScopeRow>();
  return results.map(toScope);
}

export async function addScope(db: D1Database, s: Scope): Promise<StoredScope> {
  const row = await db
    .prepare(
      `INSERT INTO scopes (date, peak_eos_hpf, proximal_eos_hpf, mid_eos_hpf, distal_eos_hpf, findings)
       VALUES (?, ?, ?, ?, ?, ?) RETURNING *`,
    )
    .bind(s.date, s.peakEosHpf, s.proximalEosHpf, s.midEosHpf, s.distalEosHpf, s.findings)
    .first<ScopeRow>();
  return toScope(row!);
}

export interface StoredEvent extends TrackerEvent {
  id: number;
  createdBy: string;
}

interface EventRow {
  id: number;
  date: string;
  type: EventType;
  text: string;
  created_by: string;
}

const toEvent = (row: EventRow): StoredEvent => ({
  id: row.id,
  date: row.date,
  type: row.type,
  text: row.text,
  createdBy: row.created_by,
});

export async function listEvents(db: D1Database): Promise<StoredEvent[]> {
  const { results } = await db.prepare("SELECT * FROM events ORDER BY date, id").all<EventRow>();
  return results.map(toEvent);
}

export async function addEvent(
  db: D1Database,
  event: TrackerEvent,
  email: string,
): Promise<StoredEvent> {
  const row = await db
    .prepare("INSERT INTO events (date, type, text, created_by) VALUES (?, ?, ?, ?) RETURNING *")
    .bind(event.date, event.type, event.text, email)
    .first<EventRow>();
  return toEvent(row!);
}
