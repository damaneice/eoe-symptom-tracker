import { addDays, daysBetween } from "./dates";
import { score } from "./score";
import type { DailyLog, Dose, IsoDate, Settings } from "./types";

export interface TrackerState {
  settings: Settings | null;
  logs: DailyLog[];
  doses: Dose[];
}

export interface WeekStats {
  /** 0 is every day before the treatment start; 1 starts on the start (or first logged) day. */
  week: number;
  from: IsoDate;
  to: IsoDate;
  daysLogged: number;
  averageScore: number;
  /** Days scoring 6 or more. */
  badDays: number;
  impactions: number;
  /** Average overall day rating, or null when no day in the week was rated. */
  averageOverall: number | null;
}

/** A day scoring this or higher counts as a bad day. */
export const BAD_DAY_SCORE = 6;

const average = (values: number[]): number | null =>
  values.length === 0 ? null : values.reduce((a, b) => a + b, 0) / values.length;

function weekStats(week: number, from: IsoDate, to: IsoDate, days: DailyLog[]): WeekStats {
  const scores = days.map(score);
  return {
    week,
    from,
    to,
    daysLogged: days.length,
    averageScore: average(scores)!,
    badDays: scores.filter((s) => s >= BAD_DAY_SCORE).length,
    impactions: days.filter((d) => d.impaction).length,
    averageOverall: average(days.flatMap((d) => (d.overall === null ? [] : [d.overall]))),
  };
}

/** A week needs at least this many logged days to count as a baseline, best or halved week. */
export const MIN_DAYS_FOR_WEEK = 3;

export interface Baseline {
  value: number;
  week: number;
  /** "treatment" when the baseline week is before the first dose; "tracking" otherwise. */
  since: "treatment" | "tracking";
}

/** A change of at least this many percent counts as better or worse. */
export const MEANINGFUL_CHANGE_PERCENT = 10;

export interface Change {
  percent: number;
  trend: "better" | "same" | "worse";
}

export interface Progress {
  /** Treatment start: the first dose date from settings, or else the earliest logged dose. */
  start: IsoDate | null;
  /** Weeks that have at least one logged day, oldest first. */
  weeks: WeekStats[];
  /** The first week with enough logged days, or null until there is one. */
  baseline: Baseline | null;
  /** Average score of the days logged in the 7 days ending today, or null if there are none. */
  last7Average: number | null;
  /** The last 7 days (ending today) against the baseline. Null when it can't be worked out. */
  last7Change: Change | null;
  /** The full week (3+ logged days) with the lowest average, earliest on a tie. */
  bestWeek: number | null;
  /**
   * The first full week after the baseline week whose average is at or below half the baseline:
   * the headline answer to "how long until it improves".
   */
  halvedWeek: number | null;
  /** Today's week and day (1–7) within it, or null before anything is logged. */
  today: { week: number; day: number } | null;
}

const earliest = (dates: IsoDate[]): IsoDate | null =>
  dates.length === 0 ? null : dates.reduce((a, b) => (b < a ? b : a));

export function progress(state: TrackerState, today: IsoDate): Progress {
  const logs = [...state.logs].sort((a, b) => (a.date < b.date ? -1 : 1));
  const start = state.settings?.firstDose ?? earliest(state.doses.map((d) => d.date));
  const anchor = start ?? logs[0]?.date ?? null;
  if (anchor === null)
    return {
      start,
      weeks: [],
      baseline: null,
      last7Average: null,
      last7Change: null,
      bestWeek: null,
      halvedWeek: null,
      today: null,
    };

  const weekNumber = (date: IsoDate) => {
    const days = daysBetween(anchor, date);
    return days < 0 ? 0 : Math.floor(days / 7) + 1;
  };

  const byWeek = new Map<number, DailyLog[]>();
  for (const entry of logs) {
    const week = weekNumber(entry.date);
    byWeek.set(week, [...(byWeek.get(week) ?? []), entry]);
  }

  const weeks = [...byWeek.entries()]
    .sort(([a], [b]) => a - b)
    .map(([week, days]): WeekStats => {
      if (week === 0) return weekStats(week, days[0]!.date, addDays(anchor, -1), days);
      const from = addDays(anchor, (week - 1) * 7);
      return weekStats(week, from, addDays(from, 6), days);
    });

  const full = weeks.filter((w) => w.daysLogged >= MIN_DAYS_FOR_WEEK);
  const first = full[0];
  const baseline: Baseline | null = first
    ? {
        value: first.averageScore,
        week: first.week,
        since: first.week === 0 ? "treatment" : "tracking",
      }
    : null;

  const windowStart = addDays(today, -6);
  const recent = average(logs.filter((l) => windowStart <= l.date && l.date <= today).map(score));
  const last7Change =
    baseline && baseline.value > 0 && recent !== null ? change(recent, baseline.value) : null;

  const best = full.reduce<WeekStats | null>(
    (lowest, w) => (lowest === null || w.averageScore < lowest.averageScore ? w : lowest),
    null,
  );
  const halved = baseline
    ? full.find((w) => w.week > baseline.week && w.averageScore <= baseline.value / 2)
    : undefined;

  const todayWeek = weekNumber(today);
  const todayDay = todayWeek === 0 ? 0 : (daysBetween(anchor, today) % 7) + 1;

  return {
    start,
    weeks,
    baseline,
    last7Average: recent,
    last7Change,
    bestWeek: best?.week ?? null,
    halvedWeek: halved?.week ?? null,
    today: { week: todayWeek, day: todayDay },
  };
}

function change(value: number, baseline: number): Change {
  const percent = ((value - baseline) * 100) / baseline;
  const trend =
    percent <= -MEANINGFUL_CHANGE_PERCENT
      ? "better"
      : percent >= MEANINGFUL_CHANGE_PERCENT
        ? "worse"
        : "same";
  return { percent, trend };
}
