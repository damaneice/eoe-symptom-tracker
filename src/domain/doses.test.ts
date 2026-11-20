import { describe, expect, it } from "vitest";
import { doseSchedule } from "./doses";
import type { Dose, Site } from "./types";

const dose = (date: string, intervalDays = 14, site: Site = "left-thigh"): Dose => ({
  date,
  mg: 300,
  intervalDays,
  site,
  sideEffect: "none",
  note: "",
});

describe("doseSchedule: next dose", () => {
  it("is due one interval after the latest dose, using that dose's own interval", () => {
    const doses = [dose("2026-11-12", 7), dose("2026-10-01", 14)];
    expect(doseSchedule(doses, "2026-11-15")).toMatchObject({
      nextDue: "2026-11-19",
      status: "ok",
    });
  });

  it("is due today on the due date, and overdue after it", () => {
    const doses = [dose("2026-11-05", 14)];
    expect(doseSchedule(doses, "2026-11-19").status).toBe("due");
    expect(doseSchedule(doses, "2026-11-20").status).toBe("overdue");
  });

  it("has nothing due before the first dose is logged", () => {
    expect(doseSchedule([], "2026-11-19")).toMatchObject({ nextDue: null, status: "none" });
  });
});

describe("doseSchedule: gaps", () => {
  it("flags a gap longer than the interval plus 2 days", () => {
    const doses = [dose("2026-10-01", 14), dose("2026-10-17", 14), dose("2026-11-04", 14)];
    // Oct 1 → Oct 17 is 16 days: allowed. Oct 17 → Nov 4 is 18 days: a gap.
    expect(doseSchedule(doses, "2026-11-05").gaps).toEqual([
      { from: "2026-10-17", to: "2026-11-04", days: 18, expectedDays: 14 },
    ]);
  });

  it("doesn't flag a switch between weekly and every 2 weeks, in either direction", () => {
    const doses = [
      dose("2026-09-01", 7),
      dose("2026-09-08", 7),
      dose("2026-09-22", 14), // switched to every 2 weeks
      dose("2026-10-06", 7), // switched back to weekly, 14 days after the last dose
      dose("2026-10-13", 7),
    ];
    expect(doseSchedule(doses, "2026-10-14").gaps).toEqual([]);
  });

  it("still flags a gap on a weekly schedule", () => {
    const doses = [dose("2026-09-01", 7), dose("2026-09-08", 7), dose("2026-09-22", 7)];
    expect(doseSchedule(doses, "2026-09-23").gaps).toEqual([
      { from: "2026-09-08", to: "2026-09-22", days: 14, expectedDays: 7 },
    ]);
  });
});

describe("doseSchedule: next injection site", () => {
  it("suggests the site after the latest dose's site in the rotation", () => {
    const doses = [dose("2026-11-12", 14, "left-abdomen"), dose("2026-10-29", 14, "right-thigh")];
    expect(doseSchedule(doses, "2026-11-19").nextSite).toBe("right-abdomen");
  });

  it("wraps from the right upper arm back to the left thigh", () => {
    expect(doseSchedule([dose("2026-11-12", 14, "right-upper-arm")], "2026-11-19").nextSite).toBe(
      "left-thigh",
    );
  });

  it("starts at the left thigh before any dose is logged", () => {
    expect(doseSchedule([], "2026-11-19").nextSite).toBe("left-thigh");
  });
});

describe("doseSchedule: every 4 weeks", () => {
  it("is due 28 days after the latest dose, and allows 2 days of slack before flagging a gap", () => {
    const doses = [dose("2026-09-01", 28), dose("2026-09-30", 28), dose("2026-10-31", 28)];
    // Sep 1 → Sep 30 is 29 days: fine. Sep 30 → Oct 31 is 31 days: a gap.
    expect(doseSchedule(doses, "2026-11-20")).toMatchObject({
      nextDue: "2026-11-28",
      status: "ok",
      gaps: [{ from: "2026-09-30", to: "2026-10-31", days: 31, expectedDays: 28 }],
    });
  });
});
