/** A local calendar date as `YYYY-MM-DD`. Never a UTC timestamp. */
export type IsoDate = string;

export interface DailyLog {
  date: IsoDate;
  /** 0 none, 1 slow or careful eating, 2 needed a drink to get food down, 3 food got stuck. */
  swallow: number;
  chest: number;
  abdo: number;
  vomit: number;
  impaction: boolean;
  eating: boolean;
  sleep: boolean;
  /** Overall day rating 0–10. Not part of the score. */
  overall: number | null;
}

/** Injection sites in rotation order. */
export const SITES = [
  "left-thigh",
  "right-thigh",
  "left-abdomen",
  "right-abdomen",
  "left-upper-arm",
  "right-upper-arm",
] as const;
export type Site = (typeof SITES)[number];

export const SIDE_EFFECTS = [
  "none",
  "injection-site-reaction",
  "eye-redness",
  "cold-sore",
  "joint-pain",
  "other",
] as const;
export type SideEffect = (typeof SIDE_EFFECTS)[number];

export interface Dose {
  date: IsoDate;
  mg: number;
  /** Copied from settings when the dose is logged, so schedule changes don't rewrite history. */
  intervalDays: number;
  site: Site;
  sideEffect: SideEffect;
  note: string;
}

export interface Scope {
  date: IsoDate;
  /** The highest eos/hpf across all biopsy sites. Drives the label and the chart marker. */
  peakEosHpf: number;
  proximalEosHpf: number | null;
  midEosHpf: number | null;
  distalEosHpf: number | null;
  findings: string;
}

export interface Settings {
  patientName: string;
  /** Optional: when unset, the earliest logged dose is the treatment start. */
  firstDose: IsoDate | null;
  intervalDays: 7 | 14;
  doseMg: number;
}
