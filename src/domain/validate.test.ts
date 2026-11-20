import { describe, expect, it } from "vitest";
import { validateDose, validateLogPatch, validateScope, validateSettings } from "./validate";

describe("validateLogPatch", () => {
  it("accepts a patch with only the fields that changed", () => {
    expect(validateLogPatch({ vomit: 2, sleep: true })).toEqual({
      ok: true,
      value: { vomit: 2, sleep: true },
    });
  });

  it("accepts clearing the overall rating", () => {
    expect(validateLogPatch({ overall: null })).toEqual({ ok: true, value: { overall: null } });
  });

  it("rejects ratings outside their range, naming the field", () => {
    const result = validateLogPatch({ swallow: 1.5, overall: 11, vomit: -1 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.errors).sort()).toEqual(["overall", "swallow", "vomit"]);
  });

  it("rejects the removed chest and stomach pain fields", () => {
    expect(validateLogPatch({ chest: 1, abdo: 2 })).toMatchObject({
      ok: false,
      errors: { chest: "Unknown field", abdo: "Unknown field" },
    });
  });

  it("rejects wrong types for the trouble flags", () => {
    const result = validateLogPatch({ impaction: 1 });
    expect(result).toMatchObject({ ok: false, errors: { impaction: expect.any(String) } });
  });

  it("rejects unknown fields and an empty patch", () => {
    expect(validateLogPatch({ date: "2026-11-01" })).toMatchObject({
      ok: false,
      errors: { date: expect.any(String) },
    });
    expect(validateLogPatch({})).toMatchObject({ ok: false });
    expect(validateLogPatch("nope")).toMatchObject({ ok: false });
  });
});

describe("validateDose", () => {
  const dose = { date: "2026-11-12", mg: 300, site: "left-thigh", sideEffect: "none", note: "" };

  it("accepts a complete dose", () => {
    expect(validateDose(dose)).toEqual({ ok: true, value: dose });
  });

  it("lets the note be left out", () => {
    const { note: _note, ...withoutNote } = dose;
    expect(validateDose(withoutNote)).toEqual({ ok: true, value: { ...withoutNote, note: "" } });
  });

  it("rejects dates that aren't real YYYY-MM-DD calendar dates", () => {
    for (const date of ["2026-02-30", "2026-11-1", "11/12/2026", "2026-11-12T10:00:00Z"]) {
      expect(validateDose({ ...dose, date })).toMatchObject({
        ok: false,
        errors: { date: expect.any(String) },
      });
    }
    expect(validateDose({ ...dose, date: "2028-02-29" }).ok).toBe(true);
  });

  it("rejects an unknown site or side effect, and a missing or non-positive mg", () => {
    const { mg: _mg, ...withoutMg } = dose;
    expect(validateDose({ ...withoutMg, site: "left-foot", sideEffect: "headache" })).toMatchObject(
      {
        ok: false,
        errors: { mg: "Required", site: expect.any(String), sideEffect: expect.any(String) },
      },
    );
    expect(validateDose({ ...dose, mg: 0 })).toMatchObject({
      ok: false,
      errors: { mg: expect.any(String) },
    });
  });

  it("doesn't accept an interval from the client, because the server copies it from settings", () => {
    expect(validateDose({ ...dose, intervalDays: 14 })).toMatchObject({
      ok: false,
      errors: { intervalDays: expect.any(String) },
    });
  });
});

describe("validateScope", () => {
  it("accepts just a date and a peak, leaving the per-site counts empty", () => {
    expect(validateScope({ date: "2026-10-01", peakEosHpf: 22 })).toEqual({
      ok: true,
      value: {
        date: "2026-10-01",
        peakEosHpf: 22,
        proximalEosHpf: null,
        midEosHpf: null,
        distalEosHpf: null,
        findings: "",
      },
    });
  });

  it("rejects a peak lower than one of the site counts", () => {
    expect(
      validateScope({ date: "2026-10-01", peakEosHpf: 10, distalEosHpf: 30, midEosHpf: 5 }),
    ).toMatchObject({ ok: false, errors: { peakEosHpf: expect.any(String) } });
  });

  it("requires the peak", () => {
    expect(validateScope({ date: "2026-10-01" })).toMatchObject({
      ok: false,
      errors: { peakEosHpf: "Required" },
    });
  });
});

describe("validateSettings", () => {
  const settings = { patientName: "Ava", firstDose: "2026-11-05", intervalDays: 14, doseMg: 300 };

  it("accepts complete settings, with the first dose date optional", () => {
    expect(validateSettings(settings)).toEqual({ ok: true, value: settings });
    const { firstDose: _firstDose, ...withoutFirstDose } = settings;
    expect(validateSettings(withoutFirstDose)).toEqual({
      ok: true,
      value: { ...settings, firstDose: null },
    });
  });

  it("allows a weekly, every-2-weeks or every-4-weeks schedule, and nothing else", () => {
    for (const intervalDays of [7, 14, 28]) {
      expect(validateSettings({ ...settings, intervalDays }).ok).toBe(true);
    }
    expect(validateSettings({ ...settings, intervalDays: 10 })).toMatchObject({
      ok: false,
      errors: { intervalDays: "Must be 7, 14 or 28" },
    });
  });

  it("requires a patient name, schedule and dose", () => {
    expect(validateSettings({ patientName: " " })).toMatchObject({
      ok: false,
      errors: { patientName: expect.any(String), intervalDays: "Required", doseMg: "Required" },
    });
  });
});
