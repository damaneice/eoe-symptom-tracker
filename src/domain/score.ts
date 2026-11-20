import type { DailyLog } from "./types";

export function score(log: DailyLog): number {
  return (
    log.swallow +
    Math.min(log.vomit, 3) +
    (log.impaction ? 3 : 0) +
    (log.eating ? 1 : 0) +
    (log.sleep ? 1 : 0)
  );
}
