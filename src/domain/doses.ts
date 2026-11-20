import { addDays, daysBetween } from "./dates";
import { SITES, type Dose, type IsoDate, type Site } from "./types";

/** Days of slack before a late dose counts as a gap. */
export const GAP_GRACE_DAYS = 2;

export interface DoseGap {
  from: IsoDate;
  to: IsoDate;
  days: number;
  expectedDays: number;
}

export interface DoseSchedule {
  /** The latest dose plus its own interval, or null before any dose is logged. */
  nextDue: IsoDate | null;
  status: "none" | "ok" | "due" | "overdue";
  /**
   * Stretches between doses longer than the interval plus the grace days. Each gap uses the
   * longer of its two doses' intervals, so switching schedules isn't flagged as a missed dose.
   */
  gaps: DoseGap[];
  /** The site after the latest dose's site in the rotation, to pre-fill the dose form. */
  nextSite: Site;
}

export function doseSchedule(doses: Dose[], today: IsoDate): DoseSchedule {
  const sorted = [...doses].sort((a, b) => (a.date < b.date ? -1 : 1));
  const latest = sorted.at(-1);
  if (!latest) return { nextDue: null, status: "none", gaps: [], nextSite: SITES[0] };

  const gaps: DoseGap[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const [before, after] = [sorted[i - 1]!, sorted[i]!];
    const days = daysBetween(before.date, after.date);
    const expectedDays = Math.max(before.intervalDays, after.intervalDays);
    if (days > expectedDays + GAP_GRACE_DAYS) {
      gaps.push({ from: before.date, to: after.date, days, expectedDays });
    }
  }

  const nextDue = addDays(latest.date, latest.intervalDays);
  const status = today < nextDue ? "ok" : today === nextDue ? "due" : "overdue";
  const nextSite = SITES[(SITES.indexOf(latest.site) + 1) % SITES.length]!;
  return { nextDue, status, gaps, nextSite };
}
