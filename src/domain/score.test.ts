import { describe, expect, it } from "vitest";
import { score } from "./score";
import type { DailyLog } from "./types";

const day = (overrides: Partial<DailyLog> = {}): DailyLog => ({
  date: "2026-11-01",
  swallow: 0,
  vomit: 0,
  impaction: false,
  eating: false,
  sleep: false,
  overall: null,
  ...overrides,
});

describe("score", () => {
  it("adds the symptom ratings and the trouble flags", () => {
    // 2 swallow + 1 vomit + 1 eating = 4
    expect(score(day({ swallow: 2, vomit: 1, eating: true }))).toBe(4);
  });
});

describe("score caps vomiting", () => {
  it("counts at most 3 vomiting episodes, so the worst day is 11", () => {
    const worst = day({
      swallow: 3,
      vomit: 5,
      impaction: true,
      eating: true,
      sleep: true,
    });
    expect(score(worst)).toBe(11);
  });
});
