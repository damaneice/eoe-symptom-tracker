import type { IsoDate } from "./types";

const MS_PER_DAY = 86_400_000;

/** Days since 1970-01-01 for a local `YYYY-MM-DD` date. UTC is used only as a fixed calendar. */
function dayNumber(date: IsoDate): number {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d) / MS_PER_DAY;
}

/** Whole days from `from` to `to`. Negative when `to` is earlier. */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  return dayNumber(to) - dayNumber(from);
}

export function addDays(date: IsoDate, days: number): IsoDate {
  return new Date((dayNumber(date) + days) * MS_PER_DAY).toISOString().slice(0, 10);
}
