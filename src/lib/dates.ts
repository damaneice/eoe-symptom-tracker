import type { IsoDate } from "../domain/types";

const pad = (n: number) => String(n).padStart(2, "0");

/** Today on this device, as `YYYY-MM-DD`. The browser decides "today", never the server. */
export function todayIso(): IsoDate {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Noon local time, so formatting never slips a day across a time zone change. */
const toLocalDate = (date: IsoDate) => {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return new Date(y, m - 1, d, 12);
};

/** "Nov 19" */
export const shortDate = (date: IsoDate) =>
  toLocalDate(date).toLocaleDateString(undefined, { month: "short", day: "numeric" });

/** "Wed, Nov 19" */
export const dayDate = (date: IsoDate) =>
  toLocalDate(date).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

/** "Nov 19, 2026" */
export const longDate = (date: IsoDate) =>
  toLocalDate(date).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

/** "9:41 PM" */
export const timeOf = (iso: string) =>
  new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

/** One decimal place, or a dash for nothing. */
export const oneDecimal = (n: number | null | undefined) =>
  n === null || n === undefined ? "—" : (Math.round(n * 10) / 10).toFixed(1);

/** "-25%" or "+10%" */
export const signedPercent = (percent: number) =>
  `${percent > 0 ? "+" : ""}${Math.round(percent)}%`;
