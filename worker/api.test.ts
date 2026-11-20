import { describe, expect, it } from "vitest";
import type { ApiState, StoredScope } from "../src/domain/api";
import { accessToken, api, CAREGIVER } from "./test/client";

const settings = { patientName: "Ava", firstDose: "2026-11-05", intervalDays: 14, doseMg: 300 };

const state = async () => (await (await api("GET", "/api/state")).json()) as ApiState;
const created = async (res: Response) => (await res.json()) as { id: number };

describe("GET /api/state", () => {
  it("starts empty, with no settings yet", async () => {
    expect(await state()).toEqual({
      settings: null,
      logs: [],
      notes: [],
      doses: [],
      scopes: [],
    });
  });
});

describe("PUT /api/settings", () => {
  it("saves the settings, and saving again replaces them", async () => {
    const res = await api("PUT", "/api/settings", { body: settings });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(settings);

    await api("PUT", "/api/settings", { body: { ...settings, intervalDays: 7, firstDose: null } });
    expect((await state()).settings).toEqual({ ...settings, intervalDays: 7, firstDose: null });
  });

  it("rejects invalid settings, naming the fields", async () => {
    const res = await api("PUT", "/api/settings", { body: { ...settings, intervalDays: 10 } });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "Invalid",
      fields: { intervalDays: "Must be 7 or 14" },
    });
  });

  it("rejects a body that isn't JSON", async () => {
    const res = await api("PUT", "/api/settings", { body: undefined });
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/logs/:date", () => {
  const empty = {
    date: "2026-11-19",
    swallow: 0,
    chest: 0,
    abdo: 0,
    vomit: 0,
    impaction: false,
    eating: false,
    sleep: false,
    overall: null,
  };

  it("creates a new day with every symptom at 0 except the fields sent", async () => {
    const res = await api("PATCH", "/api/logs/2026-11-19", { body: { vomit: 1 } });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ...empty, vomit: 1, updatedBy: CAREGIVER });
  });

  it("merges a second caregiver's changes without wiping the first caregiver's", async () => {
    await api("PATCH", "/api/logs/2026-11-19", { body: { vomit: 1, swallow: 2 } });
    const partner = await accessToken({ email: "partner@example.com" });
    await api("PATCH", "/api/logs/2026-11-19", { body: { sleep: true }, token: partner });

    expect((await state()).logs).toEqual([
      {
        ...empty,
        vomit: 1,
        swallow: 2,
        sleep: true,
        updatedBy: "partner@example.com",
        updatedAt: expect.any(String),
      },
    ]);
  });

  it("can clear the overall rating", async () => {
    await api("PATCH", "/api/logs/2026-11-19", { body: { overall: 6 } });
    await api("PATCH", "/api/logs/2026-11-19", { body: { overall: null } });
    expect((await state()).logs[0]?.overall).toBeNull();
  });

  it("rejects a date that isn't real, and invalid fields", async () => {
    expect((await api("PATCH", "/api/logs/2026-02-30", { body: { vomit: 1 } })).status).toBe(400);
    const res = await api("PATCH", "/api/logs/2026-11-19", { body: { swallow: 9 } });
    expect(res.status).toBe(400);
    expect((await state()).logs).toEqual([]);
  });
});

describe("DELETE /api/logs/:date", () => {
  it("deletes the day, and says when there was nothing to delete", async () => {
    await api("PATCH", "/api/logs/2026-11-19", { body: { vomit: 1 } });
    expect((await api("DELETE", "/api/logs/2026-11-19")).status).toBe(204);
    expect((await state()).logs).toEqual([]);
    expect((await api("DELETE", "/api/logs/2026-11-19")).status).toBe(404);
  });
});

describe("notes", () => {
  it("keeps each caregiver's note for the same day, with author and time", async () => {
    const partner = await accessToken({ email: "partner@example.com" });
    const first = await api("POST", "/api/notes", {
      body: { date: "2026-11-19", text: "Slow dinner" },
    });
    expect(first.status).toBe(201);
    await api("POST", "/api/notes", {
      body: { date: "2026-11-19", text: "Woke up coughing" },
      token: partner,
    });

    expect((await state()).notes).toEqual([
      expect.objectContaining({ date: "2026-11-19", text: "Slow dinner", author: CAREGIVER }),
      expect.objectContaining({ text: "Woke up coughing", author: "partner@example.com" }),
    ]);
  });

  it("rejects a blank note, and deletes a note by id", async () => {
    expect(
      (await api("POST", "/api/notes", { body: { date: "2026-11-19", text: " " } })).status,
    ).toBe(400);
    const { id } = await created(
      await api("POST", "/api/notes", { body: { date: "2026-11-19", text: "Fine" } }),
    );
    expect((await api("DELETE", `/api/notes/${id}`)).status).toBe(204);
    expect((await state()).notes).toEqual([]);
    expect((await api("DELETE", `/api/notes/${id}`)).status).toBe(404);
  });
});

describe("doses", () => {
  const dose = { date: "2026-11-19", mg: 300, site: "left-thigh", sideEffect: "none" };

  it("copies the interval from settings when a dose is logged", async () => {
    await api("PUT", "/api/settings", { body: settings });
    const res = await api("POST", "/api/doses", { body: dose });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({
      id: expect.any(Number),
      ...dose,
      note: "",
      intervalDays: 14,
      createdBy: CAREGIVER,
    });

    // Switching the schedule later doesn't rewrite the logged dose.
    await api("PUT", "/api/settings", { body: { ...settings, intervalDays: 7 } });
    expect((await state()).doses[0]?.intervalDays).toBe(14);
  });

  it("asks for the schedule to be set up before the first dose", async () => {
    const res = await api("POST", "/api/doses", { body: dose });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "Set up the dose schedule first" });
  });

  it("deletes a dose by id, and rejects an id that isn't a number", async () => {
    await api("PUT", "/api/settings", { body: settings });
    const { id } = await created(await api("POST", "/api/doses", { body: dose }));
    expect((await api("DELETE", `/api/doses/${id}`)).status).toBe(204);
    expect((await state()).doses).toEqual([]);
    expect((await api("DELETE", "/api/doses/abc")).status).toBe(404);
  });
});

describe("scopes", () => {
  it("saves a biopsy with optional site counts, and deletes it by id", async () => {
    const res = await api("POST", "/api/scopes", {
      body: { date: "2026-10-01", peakEosHpf: 40, distalEosHpf: 40, findings: "Furrows" },
    });
    expect(res.status).toBe(201);
    const scope = (await res.json()) as StoredScope;
    expect(scope).toEqual({
      id: expect.any(Number),
      date: "2026-10-01",
      peakEosHpf: 40,
      proximalEosHpf: null,
      midEosHpf: null,
      distalEosHpf: 40,
      findings: "Furrows",
    });
    expect((await state()).scopes).toEqual([scope]);

    expect((await api("DELETE", `/api/scopes/${scope.id}`)).status).toBe(204);
    expect((await state()).scopes).toEqual([]);
  });

  it("rejects a peak lower than a site count", async () => {
    const res = await api("POST", "/api/scopes", {
      body: { date: "2026-10-01", peakEosHpf: 10, distalEosHpf: 40 },
    });
    expect(res.status).toBe(400);
  });
});

describe("unknown routes", () => {
  it("returns 404 for a path or method the API doesn't have", async () => {
    expect((await api("GET", "/api/nope")).status).toBe(404);
    expect((await api("POST", "/api/state")).status).toBe(404);
  });
});
