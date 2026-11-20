import {
  EVENT_TYPES,
  SIDE_EFFECTS,
  SITES,
  type DailyLog,
  type Dose,
  type Scope,
  type Settings,
  type TrackerEvent,
} from "./types";

export type Result<T> = { ok: true; value: T } | { ok: false; errors: Record<string, string> };

/** Checks one field's value and returns an error message, or nothing when it's valid. */
type Rule = (value: unknown) => string | undefined;

const intInRange =
  (min: number, max: number): Rule =>
  (value) =>
    Number.isInteger(value) && (value as number) >= min && (value as number) <= max
      ? undefined
      : `Must be a whole number from ${min} to ${max}`;

const boolean: Rule = (value) => (typeof value === "boolean" ? undefined : "Must be true or false");

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** True for a real calendar date written as `YYYY-MM-DD`. */
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_DATE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

const isoDate: Rule = (value) => (isIsoDate(value) ? undefined : "Must be a date as YYYY-MM-DD");

const oneOf =
  (options: readonly string[]): Rule =>
  (value) =>
    typeof value === "string" && options.includes(value)
      ? undefined
      : `Must be one of: ${options.join(", ")}`;

const text =
  (maxLength: number): Rule =>
  (value) =>
    typeof value === "string" && value.length <= maxLength
      ? undefined
      : `Must be text of at most ${maxLength} characters`;

const nonBlankText =
  (maxLength: number): Rule =>
  (value) =>
    typeof value === "string" && value.trim() === "" ? "Can't be blank" : text(maxLength)(value);

const nullable =
  (rule: Rule): Rule =>
  (value) =>
    value === null ? undefined : rule(value);

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === "object" && input !== null && !Array.isArray(input);
}

/**
 * Checks `input` against `rules`. Fields without a rule are rejected. Fields listed in
 * `required` must be present; every other field is optional.
 */
function check<T>(
  input: unknown,
  rules: Record<string, Rule>,
  required: string[],
  defaults: Record<string, unknown> = {},
): Result<T> {
  if (!isRecord(input)) return { ok: false, errors: { _: "Must be an object" } };

  const errors: Record<string, string> = {};
  for (const [key, value] of Object.entries(input)) {
    const rule = rules[key];
    const error = rule ? rule(value) : "Unknown field";
    if (error) errors[key] = error;
  }
  for (const key of required) {
    if (!(key in input)) errors[key] = "Required";
  }

  return Object.keys(errors).length > 0
    ? { ok: false, errors }
    : { ok: true, value: { ...defaults, ...input } as T };
}

export type LogPatch = Partial<Omit<DailyLog, "date">>;

const logRules: Record<keyof LogPatch, Rule> = {
  swallow: intInRange(0, 3),
  chest: intInRange(0, 3),
  abdo: intInRange(0, 3),
  vomit: intInRange(0, 99),
  impaction: boolean,
  eating: boolean,
  sleep: boolean,
  overall: nullable(intInRange(0, 10)),
};

/** Validates the changed fields of a daily log. The date comes from the URL, not the body. */
export function validateLogPatch(input: unknown): Result<LogPatch> {
  const result = check<LogPatch>(input, logRules, []);
  if (result.ok && Object.keys(result.value).length === 0) {
    return { ok: false, errors: { _: "Nothing to save" } };
  }
  return result;
}

export type DoseInput = Omit<Dose, "intervalDays">;

const doseRules: Record<keyof DoseInput, Rule> = {
  date: isoDate,
  mg: intInRange(1, 2000),
  site: oneOf(SITES),
  sideEffect: oneOf(SIDE_EFFECTS),
  note: text(2000),
};

/** Validates a new dose. `intervalDays` is not accepted: the server copies it from settings. */
export function validateDose(input: unknown): Result<DoseInput> {
  return check(input, doseRules, ["date", "mg", "site", "sideEffect"], { note: "" });
}

const eosCount = intInRange(0, 1000);

const scopeRules: Record<keyof Scope, Rule> = {
  date: isoDate,
  peakEosHpf: eosCount,
  proximalEosHpf: nullable(eosCount),
  midEosHpf: nullable(eosCount),
  distalEosHpf: nullable(eosCount),
  findings: text(4000),
};

export function validateScope(input: unknown): Result<Scope> {
  const result = check<Scope>(input, scopeRules, ["date", "peakEosHpf"], {
    proximalEosHpf: null,
    midEosHpf: null,
    distalEosHpf: null,
    findings: "",
  });
  if (!result.ok) return result;

  const { peakEosHpf, proximalEosHpf, midEosHpf, distalEosHpf } = result.value;
  const highestSite = Math.max(...[proximalEosHpf, midEosHpf, distalEosHpf].map((n) => n ?? 0));
  if (peakEosHpf < highestSite) {
    return {
      ok: false,
      errors: { peakEosHpf: `Must be at least the highest site count (${highestSite})` },
    };
  }
  return result;
}

const eventRules: Record<keyof TrackerEvent, Rule> = {
  date: isoDate,
  type: oneOf(EVENT_TYPES),
  text: nonBlankText(2000),
};

export function validateEvent(input: unknown): Result<TrackerEvent> {
  return check(input, eventRules, ["date", "type", "text"]);
}

const settingsRules: Record<keyof Settings, Rule> = {
  patientName: nonBlankText(100),
  firstDose: nullable(isoDate),
  intervalDays: (value) => (value === 7 || value === 14 ? undefined : "Must be 7 or 14"),
  doseMg: intInRange(1, 2000),
};

export function validateSettings(input: unknown): Result<Settings> {
  return check(input, settingsRules, ["patientName", "intervalDays", "doseMg"], {
    firstDose: null,
  });
}

export interface NoteInput {
  date: string;
  text: string;
}

const noteRules: Record<keyof NoteInput, Rule> = {
  date: isoDate,
  text: nonBlankText(2000),
};

export function validateNote(input: unknown): Result<NoteInput> {
  return check(input, noteRules, ["date", "text"]);
}
