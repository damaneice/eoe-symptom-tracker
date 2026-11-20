import { createSignal } from "solid-js";
import { validateSettings } from "../domain/validate";
import { Button, Field, Hint, Panel, Status, createSave } from "../components/ui";
import { go } from "../lib/route";
import { saveSettings, state } from "../lib/store";

/** Patient and schedule settings. On first use it's the only screen, until it's saved. */
export function Setup(props: { firstUse?: boolean }) {
  const s = state.settings;
  const [patientName, setPatientName] = createSignal(s?.patientName ?? "");
  const [firstDose, setFirstDose] = createSignal(s?.firstDose ?? "");
  const [intervalDays, setIntervalDays] = createSignal<7 | 14>(s?.intervalDays ?? 14);
  const [doseMg, setDoseMg] = createSignal(s?.doseMg ? String(s.doseMg) : "300");
  const save = createSave();
  const [localErrors, setLocalErrors] = createSignal<Record<string, string>>({});
  const errors = () => ({ ...save.fields(), ...localErrors() });

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    const result = validateSettings({
      patientName: patientName().trim(),
      firstDose: firstDose() || null,
      intervalDays: intervalDays(),
      doseMg: Number(doseMg()),
    });
    if (!result.ok) return setLocalErrors(result.errors);
    setLocalErrors({});
    const ok = await save.run(() => saveSettings(result.value), "Setup saved.");
    if (ok && props.firstUse) go("log");
  }

  return (
    <div class="grid gap-4">
      <form class="contents" onSubmit={submit} autocomplete="off">
        <Panel>
          <h2 class="text-lg">{props.firstUse ? "Welcome. Let's set things up." : "Setup"}</h2>
          <div class="grid gap-3 sm:grid-cols-2">
            <Field label="Name" error={errors().patientName}>
              <input
                value={patientName()}
                onInput={(e) => setPatientName(e.currentTarget.value)}
                placeholder="Who this log is for"
                required
              />
            </Field>
            <Field label="First Dupixent dose (optional)" error={errors().firstDose}>
              <input
                type="date"
                value={firstDose()}
                onInput={(e) => setFirstDose(e.currentTarget.value)}
              />
            </Field>
            <Field label="Dosing schedule" error={errors().intervalDays}>
              <select
                value={String(intervalDays())}
                onChange={(e) => setIntervalDays(Number(e.currentTarget.value) as 7 | 14)}
              >
                <option value="7">Every week</option>
                <option value="14">Every 2 weeks</option>
              </select>
            </Field>
            <Field label="Usual dose (mg)" error={errors().doseMg}>
              <input
                type="number"
                inputmode="numeric"
                min="1"
                step="1"
                value={doseMg()}
                onInput={(e) => setDoseMg(e.currentTarget.value)}
                required
              />
            </Field>
          </div>
          <Hint>
            Days logged before the first dose become the baseline that later weeks are compared
            against. If logging starts after treatment, the first week with 3 logged days is the
            baseline, labeled "since tracking started".
          </Hint>
          <div class="flex flex-wrap items-center justify-between gap-3">
            <Status message={save.message()} error={save.failed()} />
            <Button type="submit" busy={save.busy()}>
              {save.busy() ? "Saving…" : props.firstUse ? "Save and start logging" : "Save setup"}
            </Button>
          </div>
        </Panel>
      </form>
      <Panel>
        <h3 class="text-[0.95rem]">About this log</h3>
        <Hint>
          Entries are saved online, so they show up on any phone or computer where a caregiver signs
          in. Caregivers are added or removed in the Cloudflare Access settings, not here.
        </Hint>
        <Hint>
          This is a record to bring to appointments, not medical advice. Ask her care team before
          changing doses, diet or other medicines.
        </Hint>
      </Panel>
    </div>
  );
}
