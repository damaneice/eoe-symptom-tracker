import { describe, expect, it } from "vitest";
import { progress, type TrackerState } from "./progress";
import type { DailyLog, Dose, Settings } from "./types";

const settings = (overrides: Partial<Settings> = {}): Settings => ({
  patientName: "Ava",
  firstDose: null,
  intervalDays: 14,
  doseMg: 300,
  ...overrides,
});

/** A logged day whose score is `score` (0–12), made of swallow, chest, abdo and vomiting points. */
const log = (date: string, score = 0, overrides: Partial<DailyLog> = {}): DailyLog => ({
  date,
  swallow: Math.min(score, 3),
  chest: Math.min(Math.max(score - 3, 0), 3),
  abdo: Math.min(Math.max(score - 6, 0), 3),
  vomit: Math.min(Math.max(score - 9, 0), 3),
  impaction: false,
  eating: false,
  sleep: false,
  overall: null,
  ...overrides,
});

const dose = (date: string): Dose => ({
  date,
  mg: 300,
  intervalDays: 14,
  site: "left-thigh",
  sideEffect: "none",
  note: "",
});

const state = (overrides: Partial<TrackerState> = {}): TrackerState => ({
  settings: settings(),
  logs: [],
  doses: [],
  ...overrides,
});

const weekOf = (result: ReturnType<typeof progress>, date: string) =>
  result.weeks.find((w) => w.from <= date && date <= w.to)?.week;

describe("progress: treatment weeks", () => {
  it("counts weeks from the first dose date in settings, with earlier days in week 0", () => {
    const result = progress(
      state({
        settings: settings({ firstDose: "2026-11-05" }),
        logs: [
          log("2026-10-20"),
          log("2026-11-04"),
          log("2026-11-05"),
          log("2026-11-11"),
          log("2026-11-12"),
        ],
      }),
      "2026-11-19",
    );
    expect(result.start).toBe("2026-11-05");
    expect(weekOf(result, "2026-10-20")).toBe(0);
    expect(weekOf(result, "2026-11-04")).toBe(0);
    expect(weekOf(result, "2026-11-05")).toBe(1);
    expect(weekOf(result, "2026-11-11")).toBe(1);
    expect(weekOf(result, "2026-11-12")).toBe(2);
  });

  it("uses the earliest logged dose when settings have no first dose date", () => {
    const result = progress(
      state({ doses: [dose("2026-11-19"), dose("2026-11-05")], logs: [log("2026-11-12")] }),
      "2026-11-19",
    );
    expect(result.start).toBe("2026-11-05");
    expect(weekOf(result, "2026-11-12")).toBe(2);
  });

  it("counts weeks from the first logged day when there's no treatment start at all", () => {
    const result = progress(
      state({ logs: [log("2026-11-10"), log("2026-11-03"), log("2026-11-09")] }),
      "2026-11-19",
    );
    expect(result.start).toBeNull();
    expect(weekOf(result, "2026-11-03")).toBe(1);
    expect(weekOf(result, "2026-11-09")).toBe(1);
    expect(weekOf(result, "2026-11-10")).toBe(2);
  });

  it("gives today's treatment week and day for the header", () => {
    const result = progress(
      state({ settings: settings({ firstDose: "2026-11-05" }) }),
      "2026-11-19",
    );
    expect(result.today).toEqual({ week: 3, day: 1 });
  });
});

describe("progress: weekly stats", () => {
  it("summarizes each week's scores, bad days, impactions and day ratings", () => {
    const result = progress(
      state({
        settings: settings({ firstDose: "2026-11-05" }),
        logs: [
          log("2026-11-05", 2, { overall: 5 }),
          log("2026-11-06", 5, { impaction: true }), // 5 + 3 for the impaction = 8
          log("2026-11-08", 4, { overall: 7 }),
        ],
      }),
      "2026-11-19",
    );
    expect(result.weeks).toEqual([
      {
        week: 1,
        from: "2026-11-05",
        to: "2026-11-11",
        daysLogged: 3,
        averageScore: 14 / 3,
        badDays: 1,
        impactions: 1,
        averageOverall: 6,
      },
    ]);
  });

  it("leaves the average day rating empty when no day in the week was rated", () => {
    const result = progress(state({ logs: [log("2026-11-05", 1)] }), "2026-11-19");
    expect(result.weeks[0]?.averageOverall).toBeNull();
  });
});

describe("progress: baseline", () => {
  const start = settings({ firstDose: "2026-11-05" });

  it("uses the pre-treatment week when it has at least 3 logged days", () => {
    const result = progress(
      state({
        settings: start,
        logs: [
          log("2026-10-30", 9),
          log("2026-11-01", 6),
          log("2026-11-04", 9),
          log("2026-11-05", 1),
        ],
      }),
      "2026-11-19",
    );
    expect(result.baseline).toEqual({ value: 8, week: 0, since: "treatment" });
  });

  it("falls back to the first week with 3 logged days, labeled as since tracking started", () => {
    const result = progress(
      state({
        settings: start,
        logs: [
          log("2026-11-03", 12),
          log("2026-11-04", 12),
          log("2026-11-12", 4),
          log("2026-11-13", 5),
          log("2026-11-14", 6),
        ],
      }),
      "2026-11-19",
    );
    expect(result.baseline).toEqual({ value: 5, week: 2, since: "tracking" });
  });

  it("is labeled as since tracking started when there's no treatment start", () => {
    const result = progress(
      state({ logs: [log("2026-11-01", 3), log("2026-11-02", 3), log("2026-11-03", 3)] }),
      "2026-11-19",
    );
    expect(result.baseline).toEqual({ value: 3, week: 1, since: "tracking" });
  });

  it("is empty until some week has 3 logged days", () => {
    const result = progress(
      state({ logs: [log("2026-11-01", 3), log("2026-11-02", 3)] }),
      "2026-11-19",
    );
    expect(result.baseline).toBeNull();
  });
});

describe("progress: last 7 days compared with the baseline", () => {
  // Baseline of 10 from three pre-treatment days.
  const withRecent = (...recent: DailyLog[]) =>
    state({
      settings: settings({ firstDose: "2026-11-05" }),
      logs: [log("2026-11-01", 10), log("2026-11-02", 10), log("2026-11-03", 10), ...recent],
    });

  it("is better when the average drops by 10% or more", () => {
    const result = progress(withRecent(log("2026-11-13", 9), log("2026-11-19", 9)), "2026-11-19");
    expect(result.last7Change).toEqual({ percent: -10, trend: "better" });
  });

  it("is worse when the average rises by 10% or more, and the same in between", () => {
    expect(progress(withRecent(log("2026-11-19", 11)), "2026-11-19").last7Change).toEqual({
      percent: 10,
      trend: "worse",
    });
    expect(
      progress(withRecent(log("2026-11-18", 9), log("2026-11-19", 10)), "2026-11-19").last7Change,
    ).toEqual({ percent: -5, trend: "same" });
  });

  it("only counts the 7 days ending today", () => {
    // 2026-11-12 is 7 days before today, so it's outside the window.
    const result = progress(withRecent(log("2026-11-12", 0), log("2026-11-13", 5)), "2026-11-19");
    expect(result.last7Change).toEqual({ percent: -50, trend: "better" });
  });

  it("is empty with nothing logged in the last 7 days, or no baseline, or a baseline of 0", () => {
    expect(progress(withRecent(), "2026-11-19").last7Change).toBeNull();
    expect(progress(state({ logs: [log("2026-11-19", 4)] }), "2026-11-19").last7Change).toBeNull();
    const zeroBaseline = state({
      logs: [
        log("2026-11-06", 0),
        log("2026-11-07", 0),
        log("2026-11-08", 0),
        log("2026-11-19", 2),
      ],
    });
    expect(progress(zeroBaseline, "2026-11-19").last7Change).toBeNull();
  });
});

describe("progress: best week and halved from baseline", () => {
  // Week 0 (baseline 8): Oct 29–31. Week 1: Nov 5–11. Week 2: Nov 12–18. Week 3: Nov 19–25.
  const logs = [
    ...["2026-10-29", "2026-10-30", "2026-10-31"].map((d) => log(d, 8)),
    ...["2026-11-05", "2026-11-06", "2026-11-07"].map((d) => log(d, 6)),
    log("2026-11-12", 1), // only 2 days logged in week 2, so it doesn't count
    log("2026-11-13", 1),
    ...["2026-11-19", "2026-11-20", "2026-11-21"].map((d) => log(d, 4)), // exactly half
    ...["2026-11-26", "2026-11-27", "2026-11-28"].map((d) => log(d, 4)), // week 4 ties week 3
  ];
  const result = progress(
    state({ settings: settings({ firstDose: "2026-11-05" }), logs }),
    "2026-11-28",
  );

  it("picks the lowest weekly average among weeks with 3 or more logged days, earliest on a tie", () => {
    expect(result.bestWeek).toBe(3);
  });

  it("finds the first week at or below half the baseline", () => {
    expect(result.halvedWeek).toBe(3);
  });

  it("has no halved week while no full week is at or below half", () => {
    const early = progress(
      state({ settings: settings({ firstDose: "2026-11-05" }), logs: logs.slice(0, 8) }),
      "2026-11-13",
    );
    expect(early.halvedWeek).toBeNull();
    expect(early.bestWeek).toBe(1);
  });
});

describe("progress: last 7 days average", () => {
  it("averages the scores logged in the 7 days ending today, even without a baseline", () => {
    const result = progress(
      state({ logs: [log("2026-11-12", 9), log("2026-11-13", 2), log("2026-11-19", 4)] }),
      "2026-11-19",
    );
    expect(result.last7Average).toBe(3);
  });

  it("is empty with nothing logged in the last 7 days", () => {
    expect(progress(state({ logs: [log("2026-11-01", 2)] }), "2026-11-19").last7Average).toBeNull();
  });
});
